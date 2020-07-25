# Credlify

A simple scaffolding helper for node projects.

## Installation

```
npm install --global credlify
```

## Requirements

- **CLI:** Node `12.9.0` or higher
- **Generated project:** Node `7.9.0` or higher

## Usage

```
credlify [<args>]
```

Initializes a node project with build pipeline files, directory structure, and initial dependencies.

If `gulp-cli` is installed, the resulting project can be built (with optional live development server) by running:

```
gulp
```

Available `gulp` tasks may be viewed with:

```
gulp --tasks
```

This script should be run after running `npm init`, and from the project's root directory, as it will create all files and directories relative to the current working directory. If no `package.json` file is found, the script will exit.

When the script runs, the user will be prompted to choose names for the project structure directories.

If any files already exist that conflict with those created by `credlify`, the script will exit.

In an attempt to change as little of the existing project files as possible, `credlify` will only modify the `'dependencies'` and `'devDependencies'` properties in `package.json`. Other properties (such as `'main'`, `'scripts'`, etc.) may be changed manually after the project scaffolding has been created.

## CLI Arguments

### -h, --help

Shows CLI help text.

### -v, --version

Shows the package version number.

### --no-dirs

Prevents directory structure from being generated. If this option is used, any project files in those directories will not be created.

### --no-files

Prevents project files from being created.

### --no-deps

Prevents initial project dependencies from being installed.
