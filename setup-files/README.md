# Gerald Setup README

This file is intended to help you set up [Gerald](github.com/Khan/gerald) on an existing repository.

## Repository Setup

## Files Setup

1. Copy `gerald-pr.yml` and `gerald-push.yml` to `.github/workflows`. Make a `.github/workflows` folder if it doesn't exist.
2. In `gerald-pr.yml` and `gerald-push.yml`, change the `<SECRET TOKEN>` in line 20 to be the name fo the admin permissions token that you set up in the Repository Setup section.
3. Copy `NOTIFIED` and `REVIEWERS` to `.github`.