# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an existing repository.

## Prerequisite Setup

Ensure that you have set up your GitHub repository with a 
[secret authentication token](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository) 
named `GERALD_SECRET` that has access to view teams, comment on commit messages and pull requests, 
and make review requests. (Note: If you already have a secret authentication token with the proper 
permissions set up, you can change `GERALD_SECRET` to the name of your token in `gerald-push.yml`, 
`gerald-pr.yml`, and `gerald-comment.yml`, after you've copied them into your repo.)

To take advantage of Gerald's Required Reviewers functionality, ensure that you have 
[OLC tools](github.com/Khan/our-lovely-cli) set up. If OLC tools are not set up, required reviewers 
will function no differently than reviewers, but Gerald is still usable.

Make a `.github/workflows/` folder if it doesn't already exist in your repository.

## Files Setup

1. Copy `gerald-pr.yml` and `gerald-push.yml` to the `.github/workflows` folder.
2. Copy the `NOTIFIED` and `REVIEWERS` files to the `.github` folder.
3. Add rules to the `NOTIFIED` and `REVIEWERS` files. Refer to the [`Gerald-README.md`](https://khanacademy.atlassian.net/wiki/spaces/FRONTEND/pages/598278672/Gerald+Documentation) document for more info on adding rules.
4. Highly recommended: copy `Gerald-README.md` and `Setup-README.md` into your repository to have these files handy.
