# Change Log - @rnx-kit/metro-resolver-symlinks

## 0.2.5

### Patch Changes

- 97c3a47: Fix experimental_retryResolvingFromDisk on metro 0.81
- Updated dependencies [823c587]
  - @rnx-kit/tools-react-native@2.2.0

## 0.2.4

### Patch Changes

- f145c88: `experimental_retryResolvingFromDisk` should no longer be necessary
  as of 0.82+

## 0.2.3

### Patch Changes

- 52e19c1: Use Metro's symlink resolver when available

## 0.2.2

### Patch Changes

- 4e75884: Added experimental support for `oxc-resolver` as an option

## 0.2.1

### Patch Changes

- 8461778: Verified that `experimental_retryResolvingFromDisk` works with Metro
  0.81

## 0.2.0

### Minor Changes

- 3afb5fa: Bump minimum Node version to 16.17

### Patch Changes

- Updated dependencies [3afb5fa]
  - @rnx-kit/tools-react-native@2.0.0
  - @rnx-kit/tools-node@3.0.0
  - @rnx-kit/console@2.0.0

## 0.1.36

### Patch Changes

- 487d867: Ensure hash uniqueness when `experimental_retryResolvingFromDisk` is
  enabled

## 0.1.35

### Patch Changes

- c1c0f7a: `experimental_retryResolvingFromDisk` works with Metro 0.80

## 0.1.34

### Patch Changes

- 2885f73c: Ensure correct Metro dependencies are used by traversing the
  dependency chain starting from `react-native`
- Updated dependencies [2885f73c]
  - @rnx-kit/tools-react-native@1.3.4

## 0.1.33

### Patch Changes

- 3c65642e: Print the path to the Metro instance that will be monkey patched if
  `experimental_retryResolvingFromDisk` is enabled
- Updated dependencies [55756581]
  - @rnx-kit/tools-node@2.1.0

## 0.1.32

### Patch Changes

- 6ec78905: Fix handling of asset files when
  `experimental_retryResolvingFromDisk` is enabled

## 0.1.31

### Patch Changes

- ebca91d7: Reuse `findMetroPath` from `@rnx-kit/tools-react-native`
- Updated dependencies [1bc772cc]
  - @rnx-kit/tools-react-native@1.3.2

## 0.1.30

### Patch Changes

- 259bc617: Fix `extraNodeModules` not resolving correctly when
  `experimental_retryResolvingFromDisk` is enabled

## 0.1.29

### Patch Changes

- 86d5d5c6: Correctly handle redirected modules

## 0.1.28

### Patch Changes

- Updated dependencies [f1dfcf6b]
  - @rnx-kit/tools-node@2.0.0
  - @rnx-kit/tools-react-native@1.3.1

## 0.1.27

### Patch Changes

- 9c0c87b9: Add support for the experimental `unstable_enablePackageExports`
  flag in 0.75.1

## 0.1.26

### Patch Changes

- 26e56d8f: Adjust Metro patch to use any available `hasteFS` alias

## 0.1.25

### Patch Changes

- fa2c3b29: When `experimental_retryResolvingFromDisk` is enabled, don't parse
  exports maps as they currently take precedence over the `react-native` field.

## 0.1.24

### Patch Changes

- e5aff351: Handle packages that are missing the `default` exports conditional

## 0.1.23

### Patch Changes

- 80e6557d: Add an experimental option for retrying module resolution from disk
  if not found in Haste map

## 0.1.22

### Patch Changes

- 53df63dd: Use `extraNodeModules` if it is defined (and some refactoring)
- Updated dependencies [53df63dd]
  - @rnx-kit/tools-react-native@1.2.3

## 0.1.21

### Patch Changes

- b56846f2: Fix empty modules not being handled correctly
- 28a302a1: Fix `browser` field module redirection not being handled correctly
- 4674e761: Enable `resolveSymlinks` and remove dupe code
- Updated dependencies [1edb9acd]
  - @rnx-kit/tools-node@1.3.0

## 0.1.20

### Patch Changes

- 77b9f0d9: Fix symlinks with relative paths not being resolved correctly

## 0.1.19

### Patch Changes

- ba4aaac: Updated to support Metro 0.68+
- 569a099: Bump @rnx-kit/tools-node to v1.2.7

## 0.1.18

### Patch Changes

- fd95827: Fix symlinks not being resolved

## 0.1.17

### Patch Changes

- 8ee836b: Fix `Package subpath './package.json' is not defined by "exports"`

## 0.1.16

### Patch Changes

- adf6feb: Get available platforms from disk instead of using a hard-coded list
- Updated dependencies [adf6feb]
  - @rnx-kit/tools-react-native@1.2.0

## 0.1.15

### Patch Changes

- 1a2cf67: - Refactored resolvers to conform to a single interface
  - Added a utility for remapping import paths (akin to
    babel-plugin-import-path-remapper)
  - Updated README
- Updated dependencies [1a2cf67]
  - @rnx-kit/tools-react-native@1.1.0

## 0.1.14

Tue, 30 Nov 2021 17:24:14 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.6

## 0.1.13

Thu, 18 Nov 2021 20:51:05 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.5

## 0.1.12

Fri, 05 Nov 2021 19:24:49 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.4

## 0.1.11

Fri, 05 Nov 2021 07:33:42 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.3

## 0.1.10

Wed, 03 Nov 2021 18:15:39 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.2

## 0.1.9

Mon, 01 Nov 2021 13:46:13 GMT

### Patches

- Normalize main and types fields across all packages which use them.
  (afoxman@microsoft.com)
- Bump @rnx-kit/tools-node to v1.2.1

## 0.1.8

Sat, 30 Oct 2021 07:50:51 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.2.0

## 0.1.7

Fri, 29 Oct 2021 12:14:31 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.1.6

## 0.1.6

Fri, 29 Oct 2021 10:31:10 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.1.5

## 0.1.5

Fri, 29 Oct 2021 08:51:30 GMT

### Patches

- Bump @rnx-kit/tools-node to v1.1.4

## 0.1.4

Tue, 21 Sep 2021 16:12:12 GMT

### Patches

- Fix type information not being generated correctly
  (4123478+tido64@users.noreply.github.com)

## 0.1.3

Wed, 08 Sep 2021 06:42:50 GMT

### Patches

- Fixed wrong resolved path when module is in a path within origin module path
  (4123478+tido64@users.noreply.github.com)
- Bump @rnx-kit/metro-resolver-symlinks to v0.1.3
  (4123478+tido64@users.noreply.github.com)

## 0.1.2

Fri, 03 Sep 2021 12:18:30 GMT

### Patches

- Bump @rnx-kit/metro-resolver-symlinks to v0.1.2
  (4123478+tido64@users.noreply.github.com)

## 0.1.1

Tue, 31 Aug 2021 06:43:13 GMT

### Patches

- Bump @rnx-kit/metro-resolver-symlinks to v0.1.1
  (4123478+tido64@users.noreply.github.com)

## 0.1.0

Fri, 27 Aug 2021 18:41:43 GMT

### Minor changes

- @rnx-kit/metro-resolver-symlinks is a Metro resolver with support for symlinks
  (4123478+tido64@users.noreply.github.com)
- Bump @rnx-kit/metro-resolver-symlinks to v0.1.0
  (4123478+tido64@users.noreply.github.com)
