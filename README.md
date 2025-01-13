# Dotfiles

This repository contains my personal dotfiles, managed using GNU Stow. It provides a simple and organized way to manage configuration files across different machines.

## Prerequisites

Before using these dotfiles, you need to have GNU Stow installed. On macOS, you can install it using Homebrew:

```bash
brew install stow
```

## Installation

1. Clone this repository to your home directory:
   ```bash
   git clone <repository-url> ~/.stow_directory
   ```

2. Navigate to the stow directory:
   ```bash
   cd ~/.stow_directory
   ```

3. Use stow to symlink the configurations you want:
   ```bash
   stow */     # This will stow all packages
   # OR stow specific packages:
   # stow zsh  # for zsh configuration
   # stow vim  # for vim configuration
   # etc.
   ```

## How GNU Stow Works

GNU Stow is a symlink farm manager that takes distinct packages of software and/or data located in separate directories on the filesystem, and makes them appear to be installed in the same place.

For example, if you have:
```
~/.stow_directory/zsh/.zshrc
```

When you run `stow zsh`, it will create:
```
~/.zshrc -> .stow_directory/zsh/.zshrc
```

## Uninstalling

To remove the symlinks for a specific package:
```bash
stow -D <package-name>
```

To remove all symlinks:
```bash
stow -D */
```

## Structure

Each directory in this repository represents a package that can be managed independently with stow. The directory structure mirrors how the files should appear in your home directory.

## Contributing

Feel free to fork this repository and customize it for your own use. Pull requests for improvements are welcome!

## License

This project is open source and available under the MIT License. 