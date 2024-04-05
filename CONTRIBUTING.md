# Contributing to `wonder-stuff`

🙇Thank you for your interest in contributing to the Gerald repository. However, **we are not currently accepting community contributions** on this project.

The participation of others is a wonderful 🎁gift. When we are ready to accept that gift, we will update these guidelines.
If you have already been invited to participate, the remainder of these guidelines are for you.

📖 Be sure to read our [Code of Conduct](https://github.com/Khan/gerald/blob/main/CODE_OF_CONDUCT.md).

## 🛑 Bugs And Feature Requests

⚠️ **We are not currently accepting externally raised bugs and feature requests**

## 💻 Code Changes

⚠️ **We are not currently accepting externally provided code changes**

### ⓵ Making your first change

If you are eligible to make changes, check with the maintainers for a good first issue and we'll help get you going.

### 🎬 Getting Started

To work in the `gerald` repository, follow these steps:

1. Clone the repository
   `gh repo clone Khan/wonder-stuff`
2. Install `yarn` (see [🔗yarnpkg.com](https://yarnpkg.com))
3. Run `yarn install` to install the dependencies

You can now work on `gerald`. We prefer [🔗Visual Studio Code](https://code.visualstudio.com/) as our development environment (it's cross-platform and awesome), but please use what you feel comfortable with (we'll even forgive you for using vim).

### 🧪 Code Quality

#### Manual

We love code reviews. If there are open pull requests, please feel free to review them and provide feedback. Feedback is a gift and code reviews are often a bottleneck in getting new things released. Jump in, even if you don't know anything; you probably know more than you think.

💭**REMEMBER** Be kind and considerate. Folks are volunteering their time and code reviews are a moment of vulnerability where a criticism of the code can easily become a criticism of the individual that wrote it.

1. Take your time
2. Consider how you might receive the feedback you are giving if it were attached to code you wrote
3. Favor asking questions over prescribing solutions.

#### Automated

To ensure code quality, we use prettier, Flow, eslint, and jest. These are executed automatically by the workflows.

To execute these operations outside of a pull request or commit operation, you can use `yarn`.

- `yarn flow`
- `yarn lint`
- `yarn test`
- `yarn format`

💭**REMEMBER** If you would like to contribute code changes to the project, first make sure there's a corresponding issue for the change you wish to make.

## 📦 Build And Publish

Anyone can create a local build of the distributed code by running `yarn build`. Our `pr-autofix` workflow will also perform this process and commit the result.

### Publishing

Once changes are landed to `main` and the `dist` directory is up-to-date, you should bump the version in the `package.json` (either major or minor version), commit and land that change to `main` via a PR, and then create a tag in the format `vX.Y` where `X.Y` is the version number. Then push the tag to GitHub with `git push --tags`.
