import type { Config as CLIConfig } from "@react-native-community/cli-types";
import { error, info, warn } from "@rnx-kit/console";
import { ensureDir } from "@rnx-kit/tools-filesystem";
import { keysOf } from "@rnx-kit/tools-language/properties";
import type { PackageManifest } from "@rnx-kit/tools-node/package";
import {
  findPackageDependencyDir,
  readPackage,
} from "@rnx-kit/tools-node/package";
import { findUp } from "@rnx-kit/tools-node/path";
import type { AllPlatforms } from "@rnx-kit/tools-react-native";
import { parsePlatform } from "@rnx-kit/tools-react-native";
import type { SpawnSyncOptions } from "node:child_process";
import { spawnSync } from "node:child_process";
import * as nodefs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type AndroidArchive = {
  targetName?: string;
  version?: string;
  output?: string;
  android?: {
    androidPluginVersion?: string;
    compileSdkVersion?: number;
    defaultConfig?: {
      minSdkVersion?: number;
      targetSdkVersion?: number;
    };
    kotlinVersion?: string;
  };
};

export type NativeAssets = {
  assets?: string[];
  strings?: string[];
  aar?: AndroidArchive & {
    env?: Record<string, string | number>;
    dependencies?: Record<string, AndroidArchive>;
  };
  xcassets?: string[];
};

export type Options = {
  platform: AllPlatforms;
  assetsDest: string;
  bundleAar: boolean;
  xcassetsDest?: string;
  [key: string]: unknown;
};

export type Context = {
  projectRoot: string;
  manifest: PackageManifest;
  options: Options;
  reactNativePath: string;
};

export type AssetsConfig = {
  getAssets?: (context: Context) => Promise<NativeAssets>;
};

const defaultAndroidConfig: Required<Required<AndroidArchive>["android"]> = {
  androidPluginVersion: "7.2.2",
  compileSdkVersion: 33,
  defaultConfig: {
    minSdkVersion: 23,
    targetSdkVersion: 29,
  },
  kotlinVersion: "1.7.22",
};

function cloneFile(src: string, dest: string, fs = nodefs) {
  return fs.promises.copyFile(src, dest, fs.constants.COPYFILE_FICLONE);
}

function cp_r(source: string, destination: string, fs = nodefs) {
  return fs.promises.cp(source, destination, { recursive: true });
}

function ensureOption(options: Options, opt: string, flag = opt) {
  if (options[opt] == null) {
    error(`Missing required option: --${flag}`);
    process.exit(1);
  }
}

function findGradleProject(
  projectRoot: string,
  fs = nodefs
): string | undefined {
  if (fs.existsSync(path.join(projectRoot, "android", "build.gradle"))) {
    return path.join(projectRoot, "android");
  }
  if (fs.existsSync(path.join(projectRoot, "build.gradle"))) {
    return projectRoot;
  }
  return undefined;
}

function gradleTargetName(packageName: string): string {
  return (
    packageName.startsWith("@") ? packageName.slice(1) : packageName
  ).replace(/[^\w\-.]+/g, "_");
}

function isAssetsConfig(config: unknown): config is AssetsConfig {
  return typeof config === "object" && config !== null && "getAssets" in config;
}

export function versionOf(pkgName: string, fs = nodefs): string {
  const packageDir = findPackageDependencyDir(pkgName, undefined, fs);
  if (!packageDir) {
    throw new Error(`Could not find module '${pkgName}'`);
  }

  const { version } = readPackage(packageDir, fs);
  return version;
}

function getAndroidPaths(
  context: Context,
  packageName: string,
  { targetName, version, output }: AndroidArchive,
  fs = nodefs
) {
  const projectRoot = findPackageDependencyDir(packageName, undefined, fs);
  if (!projectRoot) {
    throw new Error(`Could not find module '${packageName}'`);
  }

  const gradleFriendlyName = targetName || gradleTargetName(packageName);
  const aarVersion = version || versionOf(packageName, fs);

  switch (packageName) {
    case "hermes-engine":
      return {
        targetName: gradleFriendlyName,
        version: aarVersion,
        projectRoot,
        output: path.join(projectRoot, "android", "hermes-release.aar"),
        destination: path.join(
          context.options.assetsDest,
          "aar",
          `hermes-release-${versionOf(packageName, fs)}.aar`
        ),
      };

    case "react-native":
      return {
        targetName: gradleFriendlyName,
        version: aarVersion,
        projectRoot,
        output: path.join(projectRoot, "android"),
        destination: path.join(
          context.options.assetsDest,
          "aar",
          "react-native"
        ),
      };

    default: {
      const androidProject = findGradleProject(projectRoot, fs);
      return {
        targetName: gradleFriendlyName,
        version: aarVersion,
        projectRoot,
        androidProject,
        output:
          output ||
          (androidProject &&
            path.join(
              androidProject,
              "build",
              "outputs",
              "aar",
              `${gradleFriendlyName}-release.aar`
            )),
        destination: path.join(
          context.options.assetsDest,
          "aar",
          `${gradleFriendlyName}-${aarVersion}.aar`
        ),
      };
    }
  }
}

function run(command: string, args: string[], options: SpawnSyncOptions) {
  const { status } = spawnSync(command, args, options);
  if (status !== 0) {
    process.exit(status || 1);
  }
}

export async function assembleAarBundle(
  context: Context,
  packageName: string,
  { aar }: NativeAssets,
  fs = nodefs
): Promise<void> {
  if (!aar) {
    return;
  }

  const wrapper = os.platform() === "win32" ? "gradlew.bat" : "gradlew";
  const gradlew = findUp(wrapper, undefined, fs);
  if (!gradlew) {
    warn(`Skipped \`${packageName}\`: cannot find \`${wrapper}\``);
    return;
  }

  const { targetName, version, androidProject, output } = getAndroidPaths(
    context,
    packageName,
    aar,
    fs
  );
  if (!androidProject || !output) {
    warn(`Skipped \`${packageName}\`: cannot find \`build.gradle\``);
    return;
  }

  const { env: customEnv, dependencies, android } = aar;
  const env = {
    NODE_MODULES_PATH: path.join(process.cwd(), "node_modules"),
    REACT_NATIVE_VERSION: versionOf("react-native", fs),
    ...process.env,
    ...customEnv,
  };

  const outputDir = path.join(context.options.assetsDest, "aar");
  ensureDir(outputDir);

  const dest = path.join(outputDir, `${targetName}-${version}.aar`);

  const targets = [`:${targetName}:assembleRelease`];
  const targetsToCopy: [string, string][] = [[output, dest]];

  const settings = path.join(androidProject, "settings.gradle");
  if (fs.existsSync(settings)) {
    if (dependencies) {
      for (const [dependencyName, aar] of Object.entries(dependencies)) {
        const { targetName, output, destination } = getAndroidPaths(
          context,
          dependencyName,
          aar,
          fs
        );
        if (output) {
          if (!fs.existsSync(output)) {
            targets.push(`:${targetName}:assembleRelease`);
            targetsToCopy.push([output, destination]);
          } else if (!fs.existsSync(destination)) {
            targetsToCopy.push([output, destination]);
          }
        }
      }
    }

    // Run only one Gradle task at a time
    run(gradlew, targets, { cwd: androidProject, stdio: "inherit", env });
  } else {
    const buildDir = path.join(
      process.cwd(),
      "node_modules",
      ".rnx-gradle-build",
      targetName
    );

    const compileSdkVersion =
      android?.compileSdkVersion ?? defaultAndroidConfig.compileSdkVersion;
    const minSdkVersion =
      android?.defaultConfig?.minSdkVersion ??
      defaultAndroidConfig.defaultConfig.minSdkVersion;
    const targetSdkVersion =
      android?.defaultConfig?.targetSdkVersion ??
      defaultAndroidConfig.defaultConfig.targetSdkVersion;
    const androidPluginVersion =
      android?.androidPluginVersion ??
      defaultAndroidConfig.androidPluginVersion;
    const kotlinVersion =
      android?.kotlinVersion ?? defaultAndroidConfig.kotlinVersion;
    const buildRelativeReactNativePath = path.relative(
      buildDir,
      context.reactNativePath
    );

    const buildGradle = [
      "buildscript {",
      "  ext {",
      `      compileSdkVersion = ${compileSdkVersion}`,
      `      minSdkVersion = ${minSdkVersion}`,
      `      targetSdkVersion = ${targetSdkVersion}`,
      `      androidPluginVersion = "${androidPluginVersion}"`,
      `      kotlinVersion = "${kotlinVersion}"`,
      "  }",
      "",
      "  repositories {",
      "      mavenCentral()",
      "      google()",
      "  }",
      "",
      "  dependencies {",
      '      classpath("com.android.tools.build:gradle:${project.ext.androidPluginVersion}")',
      '      classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${project.ext.kotlinVersion}")',
      "  }",
      "}",
      "",
      "allprojects {",
      "  repositories {",
      "      maven {",
      "          // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm",
      `          url("\${rootDir}/${buildRelativeReactNativePath}/android")`,
      "      }",
      "      mavenCentral()",
      "      google()",
      "  }",
      "}",
      "",
    ].join("\n");

    const gradleProperties = "android.useAndroidX=true\n";

    const settingsGradle = [
      `include(":${targetName}")`,
      `project(":${targetName}").projectDir = file(${JSON.stringify(
        androidProject
      )})`,
      "",
    ].join("\n");

    ensureDir(buildDir);
    fs.writeFileSync(path.join(buildDir, "build.gradle"), buildGradle);
    fs.writeFileSync(
      path.join(buildDir, "gradle.properties"),
      gradleProperties
    );
    fs.writeFileSync(path.join(buildDir, "settings.gradle"), settingsGradle);

    // Run only one Gradle task at a time
    run(gradlew, targets, { cwd: buildDir, stdio: "inherit", env });
  }

  await Promise.all(
    targetsToCopy.map(([src, dest]) => cloneFile(src, dest, fs))
  );
}

function copyFiles(
  files: unknown,
  destination: string,
  fs = nodefs
): Promise<void>[] {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  ensureDir(destination, fs);
  return files.map((file) => {
    return cp_r(file, `${destination}/${path.basename(file)}`, fs);
  });
}

export async function copyAssets(
  { options: { assetsDest, xcassetsDest } }: Context,
  packageName: string,
  { assets, strings, xcassets }: NativeAssets,
  fs = nodefs
): Promise<void> {
  const tasks = [
    ...copyFiles(assets, `${assetsDest}/assets/${packageName}`, fs),
    ...copyFiles(strings, `${assetsDest}/strings/${packageName}`, fs),
  ];

  if (typeof xcassetsDest === "string") {
    tasks.push(...copyFiles(xcassets, xcassetsDest, fs));
  }

  await Promise.all(tasks);
}

export async function gatherConfigs(
  { projectRoot, manifest }: Context,
  fs = nodefs
): Promise<Record<string, AssetsConfig | null> | undefined> {
  const { dependencies, devDependencies } = manifest;
  const packages = [...keysOf(dependencies), ...keysOf(devDependencies)];
  if (packages.length === 0) {
    return;
  }

  const resolveOptions = { paths: [projectRoot] };
  const assetsConfigs: Record<string, AssetsConfig | null> = {};

  for (const pkg of packages) {
    try {
      const pkgPath = path.dirname(
        require.resolve(`${pkg}/package.json`, resolveOptions)
      );
      const reactNativeConfig = `${pkgPath}/react-native.config.js`;
      if (fs.existsSync(reactNativeConfig)) {
        const { nativeAssets } = require(reactNativeConfig);
        if (nativeAssets) {
          assetsConfigs[pkg] = nativeAssets;
        }
      }
    } catch (err) {
      warn(err);
    }
  }

  // Overrides from project config
  const reactNativeConfig = `${projectRoot}/react-native.config.js`;
  if (fs.existsSync(reactNativeConfig)) {
    const { nativeAssets } = require(reactNativeConfig);
    const overrides = Object.entries(nativeAssets);
    for (const [pkgName, config] of overrides) {
      if (config === null || isAssetsConfig(config)) {
        assetsConfigs[pkgName] = config;
      }
    }
  }

  return assetsConfigs;
}

/**
 * Copies additional assets not picked by bundlers into desired directory.
 *
 * The way this works is by scanning all direct dependencies of the current
 * project for a file, `react-native.config.js`, whose contents include a
 * field, `nativeAssets`, and a function that returns assets to copy:
 *
 * ```js
 * // react-native.config.js
 * module.exports = {
 *   nativeAssets: {
 *     getAssets: (context) => {
 *       return {
 *         assets: [],
 *         strings: [],
 *         xcassets: [],
 *       };
 *     }
 *   }
 * };
 * ```
 *
 * We also allow the project itself to override this where applicable. The
 * format is similar and looks like this:
 *
 * ```js
 * // react-native.config.js
 * module.exports = {
 *   nativeAssets: {
 *     "some-library": {
 *       getAssets: (context) => {
 *         return {
 *           assets: [],
 *           strings: [],
 *           xcassets: [],
 *         };
 *       }
 *     },
 *     "another-library": {
 *       getAssets: (context) => {
 *         return {
 *           assets: [],
 *           strings: [],
 *           xcassets: [],
 *         };
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @param options Options dictate what gets copied where
 */
export async function copyProjectAssets(
  options: Options,
  { root: projectRoot, reactNativePath }: CLIConfig,
  fs = nodefs
): Promise<void> {
  const manifest = readPackage(projectRoot);
  const context = { projectRoot, manifest, options, reactNativePath };
  const assetConfigs = await gatherConfigs(context, fs);
  if (!assetConfigs) {
    return;
  }

  const dependencies = Object.entries(assetConfigs);
  for (const [packageName, config] of dependencies) {
    if (!isAssetsConfig(config)) {
      continue;
    }

    const { getAssets } = config;
    if (typeof getAssets !== "function") {
      warn(`Skipped \`${packageName}\`: getAssets is not a function`);
      continue;
    }

    const assets = await getAssets(context);
    if (options.bundleAar && assets.aar) {
      info(`Assembling "${packageName}"`);
      await assembleAarBundle(context, packageName, assets, fs);
    } else {
      info(`Copying assets for "${packageName}"`);
      await copyAssets(context, packageName, assets, fs);
    }
  }

  if (options.bundleAar) {
    const dummyAar = { targetName: "dummy" };
    const copyTasks = [];
    for (const dependencyName of ["hermes-engine", "react-native"]) {
      const { output, destination } = getAndroidPaths(
        context,
        dependencyName,
        dummyAar,
        fs
      );
      if (
        output &&
        (!fs.existsSync(destination) || fs.statSync(destination).isDirectory())
      ) {
        info(`Copying Android Archive of "${dependencyName}"`);
        copyTasks.push(cloneFile(output, destination, fs));
      }
    }
    await Promise.all(copyTasks);
  }
}

export const rnxCopyAssetsCommand = {
  name: "rnx-copy-assets",
  description:
    "Copies additional assets not picked by bundlers into desired directory",
  func: (_argv: string[], config: CLIConfig, options: Options) => {
    ensureOption(options, "platform");
    ensureOption(options, "assetsDest", "assets-dest");
    return copyProjectAssets(options, config, nodefs);
  },
  options: [
    {
      name: "--platform <string>",
      description: "Platform to target",
      parse: parsePlatform,
    },
    {
      name: "--assets-dest <string>",
      description: "Path of the directory to copy assets into",
    },
    {
      name: "--bundle-aar [boolean]",
      description: "Whether to bundle AARs of dependencies",
      default: false,
    },
    {
      name: "--xcassets-dest <string>",
      description:
        "Path of the directory to copy Xcode asset catalogs into; asset catalogs will only be copied if a destination path is specified",
    },
  ],
};
