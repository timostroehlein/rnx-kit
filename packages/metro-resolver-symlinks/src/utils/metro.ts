import { info, warn } from "@rnx-kit/console";
import {
  findMetroPath,
  getMetroVersion,
} from "@rnx-kit/tools-react-native/metro";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import type { Options, ResolutionContextCompat } from "../types";

const RETRY_FROM_DISK_FLAG = "experimental_retryResolvingFromDisk";

function disableWithReason(reason: string) {
  warn(
    `This version of Metro ${reason}; if you still want to enable it, set it to 'force'.`
  );
  return false;
}

function fileExists(path: string): boolean {
  const stat = fs.statSync(path, { throwIfNoEntry: false });
  return Boolean(stat?.isFile());
}

function importMetroModule(path: string) {
  const modulePath = findMetroPath() + path;
  try {
    return require(modulePath);
  } catch (_) {
    throw new Error(
      `Cannot find '${modulePath}'. This probably means that ` +
        `'${RETRY_FROM_DISK_FLAG}' is not compatible with the version of ` +
        "'metro' that you are currently using. Please update to the latest " +
        "version and try again. If the issue still persists after the " +
        "update, please file a bug at " +
        "https://github.com/microsoft/rnx-kit/issues."
    );
  }
}

const metroVersion = (() => {
  let version = 0;
  return () => {
    if (version === 0) {
      const v = getMetroVersion();
      const [major, minor] = v?.split(".") ?? [0, 0];
      version = Number(major) * 1000 + Number(minor);
    }
    return version;
  };
})();

export function isPackageExportsEnabled({
  unstable_enablePackageExports,
}: Pick<ResolutionContextCompat, "unstable_enablePackageExports">): boolean {
  // https://github.com/facebook/metro/releases/tag/v0.82.0
  return unstable_enablePackageExports == null
    ? metroVersion() >= 82
    : unstable_enablePackageExports;
}

export function supportsSymlinks(): boolean {
  // https://github.com/facebook/metro/releases/tag/v0.81.0
  return metroVersion() >= 81;
}

export function shouldEnableRetryResolvingFromDisk({
  experimental_retryResolvingFromDisk,
}: Pick<Options, typeof RETRY_FROM_DISK_FLAG>): boolean {
  if (
    experimental_retryResolvingFromDisk &&
    experimental_retryResolvingFromDisk !== "force"
  ) {
    const v = metroVersion();
    if (v < 64) {
      return disableWithReason(
        `has not been tested with '${RETRY_FROM_DISK_FLAG}'`
      );
    } else if (v > 81) {
      return disableWithReason(
        `should no longer need '${RETRY_FROM_DISK_FLAG}'`
      );
    }
  }

  return Boolean(experimental_retryResolvingFromDisk);
}

/**
 * Monkey-patches Metro to not use HasteFS as the only source for module
 * resolution.
 *
 * Practically every file system operation in Metro must go through HasteFS,
 * most notably watching for file changes and resolving node modules. If Metro
 * cannot find a file in the Haste map, it does not exist. This means that for
 * Metro to find a file, all folders must be declared in `watchFolders`,
 * including `node_modules` and any dependency storage folders (e.g. pnpm)
 * regardless of whether we need to watch them. In big monorepos, this can
 * easily overwhelm file watchers, even with Watchman installed.
 *
 * There's no way to avoid the initial crawling of the file system. However, we
 * can drastically reduce the number of files that needs to be crawled/watched
 * by not relying solely on Haste for module resolution. This requires patching
 * Metro to use `fs.existsSync` instead of `HasteFS.exists`. With this change,
 * we can list only the folders that we care about in `watchFolders`. In some
 * cases, like on CI, we can even set `watchFolders` to an empty array to limit
 * watched files to the current package only.
 *
 * Why didn't we use `hasteImplModulePath`? Contrary to the name, it doesn't
 * let you replace HasteFS. As of 0.73, it is only used to retrieve the path of
 * a module. The default implementation returns
 * `path.relative(projectRoot, filePath)` if the entry is not found in the map.
 *
 * @param options Options passed to Metro
 */
export function patchMetro(options: Options): void {
  if (!shouldEnableRetryResolvingFromDisk(options)) {
    return;
  }

  info(`${RETRY_FROM_DISK_FLAG}: Patching '${findMetroPath()}'`);

  const DependencyGraph = importMetroModule("/src/node-haste/DependencyGraph");

  // Patch `_createModuleResolver` and `_doesFileExist` to use `fs.existsSync`.
  DependencyGraph.prototype.orig__createModuleResolver =
    DependencyGraph.prototype._createModuleResolver;
  DependencyGraph.prototype._createModuleResolver = function (): void {
    const hasteFS =
      this._fileSystem || // >= 0.73.5
      this._snapshotFS || // 0.73.4
      this._hasteFS; // < 0.73.4

    this._doesFileExist = (filePath: string): boolean => {
      return hasteFS.exists(filePath) || fileExists(filePath);
    };

    this.orig__createModuleResolver();
    if (typeof this._moduleResolver._options.resolveAsset !== "function") {
      throw new Error("Could not find `resolveAsset` in `ModuleResolver`");
    }

    this._moduleResolver._options.resolveAsset = (
      dirPath: string,
      assetName: string,
      extension: string
    ) => {
      const basePath = dirPath + path.sep + assetName;
      const assets = [
        basePath + extension,
        ...this._config.resolver.assetResolutions.map(
          (resolution: string) => basePath + "@" + resolution + "x" + extension
        ),
      ].filter(this._doesFileExist);
      return assets.length ? assets : null;
    };
  };

  // Since we will be resolving files outside of `watchFolders`, their hashes
  // will not be found. We'll return the `filePath` as they should be unique.
  DependencyGraph.prototype.orig_getSha1 = DependencyGraph.prototype.getSha1;
  DependencyGraph.prototype.getSha1 = function (filePath: string): string {
    try {
      return this.orig_getSha1(filePath);
    } catch (e) {
      // `ReferenceError` will always be thrown when Metro encounters a file
      // that does not exist in the Haste map.
      // In metro 0.81 (https://github.com/facebook/metro/pull/1435)
      // this was changed to a standard `Error` - so verify the message
      if (
        e instanceof ReferenceError ||
        (e instanceof Error && e.message.startsWith("Failed to get the SHA-1"))
      ) {
        // Paths generated by pnpm setups include version numbers and/or hashes
        if (filePath.includes(".pnpm-store") || filePath.includes(".store")) {
          return filePath;
        }

        const stat = fs.lstatSync(filePath);
        return filePath + "|" + stat.mtime.toISOString();
      }

      throw e;
    }
  };

  // We need to patch `_processSingleAssetRequest` because it calls
  // `Assets.getAsset`, and `Assets.getAsset` checks whether the asset lives
  // under one of `projectRoot` or `watchFolders`.
  const Server = importMetroModule("/src/Server");
  Server.prototype.orig__processSingleAssetRequest =
    Server.prototype._processSingleAssetRequest;
  Server.prototype._processSingleAssetRequest = function (
    req: { url: string },
    res: unknown
  ): Promise<void> {
    // eslint-disable-next-line n/no-deprecated-api
    const urlObj = url.parse(decodeURI(req.url), true);
    let [, assetPath] =
      (urlObj &&
        urlObj.pathname &&
        urlObj.pathname.match(/^\/assets\/(.+)$/)) ||
      [];

    if (!assetPath && urlObj && urlObj.query && urlObj.query.unstable_path) {
      const unstable_path = Array.isArray(urlObj.query.unstable_path)
        ? urlObj.query.unstable_path[0]
        : urlObj.query.unstable_path;
      const result = unstable_path.match(/^([^?]*)\??(.*)$/);
      if (result == null) {
        throw new Error(`Unable to parse URL: ${unstable_path}`);
      }

      const [, actualPath] = result;
      assetPath = actualPath;
    }

    if (!assetPath) {
      throw new Error(`Could not extract asset path from URL: ${req.url}`);
    }

    const watchFolders = this.getWatchFolders();
    const absolutePath = path.resolve(this._config.projectRoot, assetPath);
    this._config.watchFolders = [path.dirname(absolutePath)];

    try {
      return this.orig__processSingleAssetRequest(req, res);
    } finally {
      this._config.watchFolders = watchFolders;
    }
  };
}
