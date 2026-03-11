# Contributing to LocalCare Finder

First off, thank you for considering contributing to LocalCare Finder! It's people like you that make open-source software such a great community to learn, inspire, and create.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/arupdas0825/localcare-finder/issues) page to see if someone else has already created a ticket. If not, go ahead and make one!

## Fork & Create a Branch

If you are ready to start writing code, follow these steps to contribute:

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/localcare-finder.git
   cd localcare-finder
   ```
3. **Add the original repository** as a remote named `upstream`:
   ```bash
   git remote add upstream https://github.com/arupdas0825/localcare-finder.git
   ```
4. **Create a new branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   # OR
   git checkout -b fix/your-bug-fix-name
   ```

## Coding Standards

### Python
* We follow [PEP 8](https://peps.python.org/pep-0008/) style guidelines.
* Ensure all functions and classes have clear, descriptive docstrings.
* Run `flake8` to lint your code before committing.
* Use type hints where appropriate to improve code readability.

### HTML/CSS/JavaScript
* Use semantic HTML5 elements.
* Keep CSS modular. We use standard CSS variables (Custom Properties) for theming.
* Write Vanilla JavaScript (ES6+). Do not introduce heavy libraries (like jQuery) unless absolutely necessary and discussed first.

## Commit Message Format

Please format your commit messages clearly and concisely. We prefer the [Conventional Commits](https://www.conventionalcommits.org/) format:

* `feat:` A new feature
* `fix:` A bug fix
* `docs:` Documentation only changes
* `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* `refactor:` A code change that neither fixes a bug nor adds a feature
* `perf:` A code change that improves performance
* `test:` Adding missing tests or correcting existing tests

**Example:**
`feat: add user authentication for syncing favorites`

## Submitting a Pull Request

1. Make sure your code is thoroughly tested locally.
2. Update the `README.md` with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request from your fork to the `main` branch of `arupdas0825/localcare-finder`.
5. Clearly describe what your PR accomplishes in the description box. Link to any relevant issues (e.g., "Fixes #12").

## Reporting Bugs

If you find a bug in the source code, you can help us by submitting an issue to our GitHub Repository. Even better, you can submit a Pull Request with a fix.

Please include:
- A quick summary and/or background.
- Steps to reproduce.
- What you expected would happen.
- What actually happens.
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work).

## Suggesting Features

If you have an idea that could make LocalCare Finder better, we'd love to hear it!
Please open an issue describing your idea, why it would be beneficial, and any potential implementation thoughts you might have.
