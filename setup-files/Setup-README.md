# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an existing repository.

## Prerequisite Setup

Ensure that you have set up your GitHub repository with a [secret authentication token](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository) that has access to view teams, comment on commit messages and pull requests, and make review requests.

To take advantage of Gerald's Required Reviewers functionality, ensure that you have [OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are not set up, required reviewers will function no differently than reviewers, but Gerald is still usable.

Make a `.github/workflows/` folder if it doesn't already exist in your repository.

## Files Setup

1. Copy `gerald-pr.yml` and `gerald-push.yml` to the `.github/workflows` folder.
2. Change the `<SECRET TOKEN>` in line 14 of `gerald-pr.yml` and line 20 of `gerald-push.yml` to be the name of the secret authentication token that you set up in the Prerequisite Setup section.
3. Copy the `NOTIFIED` and `REVIEWERS` files to the `.github` folder.
4. Add rules to the `NOTIFIED` and `REVIEWERS` files. Refer to the [`Gerald-README.md`](https://khanacademy.atlassian.net/wiki/spaces/FRONTEND/pages/598278672/Gerald+Documentation) document for more info on adding rules.
5. Highly recommended: copy `Gerald-README.md` and `Setup-README.md` into your repository to have these files handy.
