#!/usr/bin/env node

const octokit = require('@actions/github');

const extraPermGithub = new octokit.GitHub(process.argv[2]);
const context = octokit.context;

console.log(context.payload.commits.length);
