# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an existing repository.

## Prerequisite Setup

* In order for Gerald to manage pull requests & reviewers and make comments, it needs there to be a [secret](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository) named `GERALD_ACCESS_TOKEN` that contains a [personal access token](https://github.com/settings/tokens/new) with the "repo" [scope](https://docs.github.com/en/developers/apps/scopes-for-oauth-apps) (or "public_repo" if you're not on a private repository).

* To take advantage of Gerald's Required Reviewers functionality, ensure that you have [OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are not set up, required reviewers will function no differently than reviewers, but Gerald is still usable.

* Make a `.github/workflows/` folder if it doesn't already exist in your repository.

## Files Setup

1. Copy `gerald-pr.yml`, `gerald-push.yml`, and `gerald-comment.yml` to the `.github/workflows` folder.
2. Copy the `NOTIFIED` and `REVIEWERS` files to the `.github` folder.
3. Add rules to the `NOTIFIED` and `REVIEWERS` files. Refer to the [`Gerald-README.md`](./Gerald-README.md) document for more info on adding rules.
4. Highly recommended: copy `Gerald-README.md` and `Setup-README.md` into your repository to have these files handy.
