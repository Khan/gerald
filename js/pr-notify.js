#!/usr/bin/env node
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPullRequest=_require.runPullRequest,runPush=_require.runPush;try{if(process.env['EVENT']==='pull_request'){runPullRequest();}else{runPush();}}catch(error){core.setFailed(error.message);}