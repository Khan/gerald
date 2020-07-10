#!/usr/bin/env node
<<<<<<< HEAD
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPullRequest=_require.runPullRequest;try{console.log(process.env.GITHUB_EVENT);runPullRequest();}catch(error){core.setFailed(error.message);}
=======
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPullRequest=_require.runPullRequest,runPush=_require.runPush;try{if(process.env['EVENT']==='pull_request'){runPullRequest();}else{runPush();}}catch(error){core.setFailed(error.message);}
>>>>>>> dd460b597390e358d4ae4a428048c475977ea20b
