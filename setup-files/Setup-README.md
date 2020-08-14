# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an existing repository.

## Prerequisite Setup

<<<<<<< HEAD
* In order for Gerald to manage pull requests & reviewers and make comments, it needs there to be a [secret](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository) named `GERALD_ACCESS_TOKEN` that contains a [personal access token](https://github.com/settings/tokens/new) with the "repo" [scope](https://docs.github.com/en/developers/apps/scopes-for-oauth-apps) (or "public_repo" if you're not on a private repository).

* To take advantage of Gerald's Required Reviewers functionality, ensure that you have [OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are not set up, required reviewers will function no differently than reviewers, but Gerald is still usable.
=======
Ensure that you have set up your GitHub repository with a
[secret authentication token](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository)
named `GERALD_SECRET` that has access to view teams, comment on commit messages and pull requests,
and make review requests. (Note: If you already have a secret authentication token with the proper
permissions set up, you can change `GERALD_SECRET` to the name of your token in `gerald-push.yml`,
`gerald-pr.yml`, and `gerald-comment.yml`, after you've copied them into your repo.)

To take advantage of Gerald's Required Reviewers functionality, ensure that you have
[OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are not set up, required reviewers
will function no differently than reviewers, but Gerald is still usable.
>>>>>>> 09f80b2cd2a9e468a24eed29cc009addb75c7632

* Make a `.github/workflows/` folder if it doesn't already exist in your repository.

## Files Setup

1. Copy `gerald-pr.yml`, `gerald-push.yml`, and `gerald-comment.yml` to the `.github/workflows` folder.
2. Copy the `NOTIFIED` and `REVIEWERS` files to the `.github` folder.
3. Add rules to the `NOTIFIED` and `REVIEWERS` files. Refer to the [`Gerald-README.md`](./Gerald-README.md) document for more info on adding rules.
4. Highly recommended: copy `Gerald-README.md` and `Setup-README.md` into your repository to have these files handy.

## (Optional) Setting up Gerald-Tester

1. Open `~/.profile` in any editor.
2. Add the line `export PATH="$HOME/<PATH TO CURRENT WORKING DIRECTORY>/bin:$PATH"`.
3. Reopen your terminal. You should now be able to use `git gerald-tester`.
