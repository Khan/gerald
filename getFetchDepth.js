#!/usr/bin/env node

const core = require('@actions/core'); //flow-uncovered-line
const octokit = require('@actions/github'); //flow-uncovered-line

const extraPermGithub = new octokit.GitHub(process.argv[2]);
const context = octokit.context;

core.setOutput('fetchDepth', context.payload.commits.length); //flow-uncovered-line
