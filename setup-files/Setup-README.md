# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an
existing repository.

## Prerequisite Setup

* In order for Gerald to manage pull requests & reviewers and make comments, you need to give Write access to the `@Khan/khan-actions-bot` team for the repo. When viewing the repo in Github you can achieve this by clicking Settings > Manage access > Invite teams or people > Typing `@Khan/khan-actions-bot` then giving that team write access.

* To take advantage of Gerald's Required Reviewers functionality, ensure that
you have [OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are
not set up, required reviewers will function no differently than reviewers, but
Gerald is still usable.

* Make a `.github/workflows/` folder if it doesn't already exist in your repository.

## Files Setup

1. Copy `gerald-pr.yml`, `gerald-push.yml`, and `gerald-comment.yml` to the
`.github/workflows` folder.
2. Copy the `NOTIFIED` and `REVIEWERS` files to the `.github` folder.
3. Add rules to the `NOTIFIED` and `REVIEWERS` files. Refer to the
[`Gerald-README.md`](./Gerald-README.md) document for more info on adding rules.
4. Highly recommended: copy `Gerald-README.md` and `Setup-README.md` into your
repository to have these files handy.

## (Optional) Setting up Gerald-Tester

1. Open `~/.profile` in any editor.
2. Add the line `export PATH="$HOME/<PATH TO CURRENT WORKING DIRECTORY>/bin:$PATH"`.
3. Reopen your terminal. You should now be able to use `git gerald-tester`.
