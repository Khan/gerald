#!/usr/bin/env node
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPullRequest=_require.runPullRequest;try{runPullRequest();}catch(error){core.setFailed(error.message);}
