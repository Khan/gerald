var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var _extends2=_interopRequireDefault(require("@babel/runtime/helpers/extends"));var _require=require('../utils'),__maybeAddIfMatch=_require.__maybeAddIfMatch,__turnPatternIntoRegex=_require.__turnPatternIntoRegex,__parseUsername=_require.__parseUsername,__pushOrSetToBin=_require.__pushOrSetToBin,getNotified=_require.getNotified,getReviewers=_require.getReviewers,parseExistingComments=_require.parseExistingComments,getFileDiffs=_require.getFileDiffs,getFilteredLists=_require.getFilteredLists;var mockTestFileDiff="a/testFile b/testFile\nnew file mode 123456\nindex 0000000..1234567\n--- /dev/null\n+++ b/testFile\n@@ -0,0 +1,220 @@\n+this is a new line that was added\n-this is an old line that was removed\n";var mockOtherFileDiff="a/otherFile.js b/otherFile.js\nnew file mode 123456\nindex 0000000..1234567\n--- /dev/null\n+++ b/otherFile.js\n@@ -0,0 +1,220 @@\nexport const testFn = () => {\n-   console.log('hi');\n+   console.log('hello world');\n}\n";jest.mock('../execCmd.js',function(){return(0,_extends2.default)({},jest.requireActual('../execCmd.js'),{execCmd:function execCmd(cmd,args){return _regenerator.default.async(function execCmd$(_context){while(1){switch(_context.prev=_context.next){case 0:_context.next=2;return _regenerator.default.awrap(new Promise(function(res,rej){var string="diff --git "+mockTestFileDiff+"diff --git "+mockOtherFileDiff;process.nextTick(function(){return res(string);});}));case 2:return _context.abrupt("return",_context.sent);case 3:case"end":return _context.stop();}}},null,null,null,Promise);}});});describe('maybe add',function(){it('should work',function(){var pattern=/test/;var diffs={testFile:'a diff with the word test'};var name='testName';var bin={testName:[]};__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});pattern=/nonexistent/;__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});pattern=/existent/;diffs={otherFile:'the word existent exists in this diff'};__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile','otherFile']});});});describe('turn into regex',function(){it('should work',function(){var pattern='"/test/ig"';var result=__turnPatternIntoRegex(pattern);expect(result.flags.split('')).toEqual(expect.arrayContaining(['i','g']));expect(result.source).toEqual('test');});it('should work',function(){var pattern='"/look for "quotes"/img"';var result=__turnPatternIntoRegex(pattern);expect(result.flags.split('')).toEqual(expect.arrayContaining(['i','g','m']));});it('should error',function(){var pattern='/this is invalid/';try{__turnPatternIntoRegex(pattern);}catch(e){expect(e).toEqual(new Error("The RegExp: "+pattern+" isn't valid"));}});});describe('parse usernames',function(){it('should work',function(){var original='@yipstanley!';var result=__parseUsername(original);expect(result).toEqual({original:original,username:'@yipstanley',justName:'yipstanley',isRequired:true});});it('should work',function(){var original='@yipstanley';var result=__parseUsername(original);expect(result).toEqual({original:original,username:'@yipstanley',justName:'yipstanley',isRequired:false});});});describe('push or set to bin',function(){it('should work',function(){var bin={};var username='testName';var files=['file1','file2'];__pushOrSetToBin(bin,username,files);expect(bin).toEqual({testName:files});files=['file2','file3','file4'];__pushOrSetToBin(bin,username,files);expect(bin).toEqual({testName:['file1','file2','file3','file4']});});});describe('get notified',function(){it('should work',function(){var notifiedFile="# comment\n*                   @githubUser\n*.js                @yipstanley @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson\n\n## ON PUSH WITHOUT PULL REQUEST\n\n*.js                @owner";var filesChanged=['pr-notify.js','pr-notify.yml'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};expect(getNotified(filesChanged,fileDiffs,'pull_request',notifiedFile)).toEqual({'@yipstanley':['pr-notify.js'],'@githubUser':['pr-notify.js','pr-notify.yml'],'@testperson':['yaml.yml']});expect(getNotified(filesChanged,fileDiffs,'push',notifiedFile)).toEqual({'@owner':['.pr-notify.js']});});});describe('get reviewers',function(){it('should work',function(){var reviewersFile="# comment\n.github/**          @githubUser!\n*.js                @yipstanley! @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson";var filesChanged=['.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml','.github/NOTIFIED'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};var _getReviewers=getReviewers(filesChanged,fileDiffs,'yipstanley',reviewersFile),requiredReviewers=_getReviewers.requiredReviewers,reviewers=_getReviewers.reviewers;expect(reviewers).toEqual({'@githubUser':['.github/workflows/pr-notify.js'],'@testperson':['yaml.yml']});expect(requiredReviewers).toEqual({'@githubUser':['.github/NOTIFIED','.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml']});});});describe('get filtered lists',function(){it('should work',function(){var sampleFile="# comment\n.github/**          @githubUser!\n*.js                @yipstanley! @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson\n\n## ON PUSH WITHOUT PULL REQUEST";var filesChanged=['.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml','.github/NOTIFIED'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};var _getReviewers2=getReviewers(filesChanged,fileDiffs,'yipstanley',sampleFile),requiredReviewers=_getReviewers2.requiredReviewers,reviewers=_getReviewers2.reviewers;var notified=getNotified(filesChanged,fileDiffs,'pull_request',sampleFile);var _getFilteredLists=getFilteredLists(reviewers,requiredReviewers,notified,['yipstanley','testperson']),actualReviewers=_getFilteredLists.actualReviewers,teamReviewers=_getFilteredLists.teamReviewers;expect(actualReviewers).toEqual(expect.arrayContaining(['githubUser']));});});describe('parse existing comments',function(){it('should work',function(){var gerald={user:{login:'github-actions[bot]'},body:"# Gerald:\n\n            ## Notified:\n\n            ## Reviewers:\n\n            ## Required reviewers:"};var existingComments={data:[gerald,{user:{login:'github-actions[bot]'},body:'irrelevant comment'},{user:{login:'github-actions[bot]'},body:'another irrelevant comment'},{user:{login:'yipstanley'},body:'#removeme'},{user:{login:'github-actions[bot]'},body:'Required Reviewers:\n\n:'},{user:{login:'github-actions[bot]'},body:'Reviewers:\n\n:'}]};var _parseExistingComment=parseExistingComments(existingComments),megaComment=_parseExistingComment.megaComment,removedJustNames=_parseExistingComment.removedJustNames;expect(megaComment).toEqual(megaComment);expect(removedJustNames).toEqual(['yipstanley']);});});describe('test get file diffs',function(){it('should work',function _callee(){var result;return _regenerator.default.async(function _callee$(_context2){while(1){switch(_context2.prev=_context2.next){case 0:_context2.next=2;return _regenerator.default.awrap(getFileDiffs(''));case 2:result=_context2.sent;expect(result['testFile']).toEqual(mockTestFileDiff);expect(result['otherFile.js']).toEqual(mockOtherFileDiff);case 5:case"end":return _context2.stop();}}},null,null,null,Promise);});});
var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var exec=require('@actions/exec');var execCmd=function execCmd(cmd,args){var output,error,options;return _regenerator.default.async(function execCmd$(_context){while(1){switch(_context.prev=_context.next){case 0:output='';error='';options={};options.listeners={stdout:function stdout(data){output+=data.toString();},stderr:function stderr(data){error+=data.toString();}};_context.next=6;return _regenerator.default.awrap(exec.exec(cmd,args,options));case 6:if(!error){_context.next=8;break;}throw error;case 8:return _context.abrupt("return",output);case 9:case"end":return _context.stop();}}},null,null,null,Promise);};module.exports={execCmd:execCmd};
var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var _extends2=_interopRequireDefault(require("@babel/runtime/helpers/extends"));function _createForOfIteratorHelperLoose(o,allowArrayLike){var it;if(typeof Symbol==="undefined"||o[Symbol.iterator]==null){if(Array.isArray(o)||(it=_unsupportedIterableToArray(o))||allowArrayLike&&o&&typeof o.length==="number"){if(it)o=it;var i=0;return function(){if(i>=o.length)return{done:true};return{done:false,value:o[i++]};};}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");}it=o[Symbol.iterator]();return it.next.bind(it);}function _unsupportedIterableToArray(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen);}function _arrayLikeToArray(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i];}return arr2;}var path=require('path');var octokit=require('@actions/github');var _require=require('./utils'),getReviewers=_require.getReviewers,getNotified=_require.getNotified,getFileDiffs=_require.getFileDiffs,parseExistingComments=_require.parseExistingComments,getFilteredLists=_require.getFilteredLists;var _require2=require('./execCmd'),execCmd=_require2.execCmd;var khanActionsBot=new octokit.GitHub(process.env['KHAN_ACTIONS_BOT_TOKEN']);var github=new octokit.GitHub(process.env['GITHUB_TOKEN']);var context=octokit.context;var ownerAndRepo={owner:context.issue.owner,repo:context.issue.repo};var separator='__________________________________________________________________________________________________________________________________';var makeCommentBody=function makeCommentBody(peopleToFiles,sectionHeader){var names=Object.keys(peopleToFiles);if(names.length){var body="### "+sectionHeader;names.forEach(function(person){var files=peopleToFiles[person];body+=person+" for changes to `"+files.join('`, `')+"`\n\n";});return body;}return'';};var updatePullRequestComment=function updatePullRequestComment(comment,notifyees,reviewers,requiredReviewers){var body;return _regenerator.default.async(function updatePullRequestComment$(_context){while(1){switch(_context.prev=_context.next){case 0:body='# Gerald:\n\n';body+=makeCommentBody(notifyees,'Notified:\n');body+=makeCommentBody(reviewers,'Reviewers:\n');body+=makeCommentBody(requiredReviewers,'Required reviewers:\n');if(!body.match(/^### (Reviewers:|Required Reviewers:|Notified:)$/m)){_context.next=16;break;}body+="\n"+separator+"\n_Don't want to be involved in this pull request? Comment `#removeme` and we won't notify you of further changes._";console.log(body);if(!comment){_context.next=12;break;}_context.next=10;return _regenerator.default.awrap(github.issues.updateComment((0,_extends2.default)({},ownerAndRepo,{comment_id:comment.id,body:body})));case 10:_context.next=14;break;case 12:_context.next=14;return _regenerator.default.awrap(github.issues.createComment((0,_extends2.default)({},ownerAndRepo,{issue_number:context.issue.number,body:body})));case 14:_context.next=19;break;case 16:if(!comment){_context.next=19;break;}_context.next=19;return _regenerator.default.awrap(github.issues.deleteComment((0,_extends2.default)({},ownerAndRepo,{comment_id:comment.id})));case 19:case"end":return _context.stop();}}},null,null,null,Promise);};var makeCommitComments=function makeCommitComments(peopleToFiles){var names,body,_iterator,_step,commit;return _regenerator.default.async(function makeCommitComments$(_context2){while(1){switch(_context2.prev=_context2.next){case 0:names=Object.keys(peopleToFiles);if(!(peopleToFiles&&names.length)){_context2.next=11;break;}body='Notify of Push Without Pull Request\n\n';names.forEach(function(person){var files=peopleToFiles[person];body+=person+" for changes to `"+files.join('`, `')+"`\n";});_iterator=_createForOfIteratorHelperLoose(context.payload.commits);case 5:if((_step=_iterator()).done){_context2.next=11;break;}commit=_step.value;_context2.next=9;return _regenerator.default.awrap(khanActionsBot.repos.createCommitComment((0,_extends2.default)({},ownerAndRepo,{commit_sha:commit.id,body:body})));case 9:_context2.next=5;break;case 11:case"end":return _context2.stop();}}},null,null,null,Promise);};var runPullRequest=function runPullRequest(){var filesChanged,fileDiffs,notified,_getReviewers,reviewers,requiredReviewers,existingComments,_parseExistingComment,megaComment,removedJustNames,_getFilteredLists,actualReviewers,teamReviewers;return _regenerator.default.async(function runPullRequest$(_context3){while(1){switch(_context3.prev=_context3.next){case 0:_context3.next=2;return _regenerator.default.awrap(execCmd('git',['diff','origin/'+context.payload.pull_request.base.ref,'--name-only']));case 2:filesChanged=_context3.sent.split('\n');_context3.next=5;return _regenerator.default.awrap(getFileDiffs('origin/'+context.payload.pull_request.base.ref));case 5:fileDiffs=_context3.sent;notified=getNotified(filesChanged,fileDiffs,'pull_request');_getReviewers=getReviewers(filesChanged,fileDiffs,context.payload.pull_request.user.login),reviewers=_getReviewers.reviewers,requiredReviewers=_getReviewers.requiredReviewers;_context3.next=10;return _regenerator.default.awrap(github.issues.listComments((0,_extends2.default)({},ownerAndRepo,{issue_number:context.issue.number})));case 10:existingComments=_context3.sent;_parseExistingComment=parseExistingComments(existingComments),megaComment=_parseExistingComment.megaComment,removedJustNames=_parseExistingComment.removedJustNames;_getFilteredLists=getFilteredLists(reviewers,requiredReviewers,notified,removedJustNames),actualReviewers=_getFilteredLists.actualReviewers,teamReviewers=_getFilteredLists.teamReviewers;_context3.next=15;return _regenerator.default.awrap(khanActionsBot.pulls.createReviewRequest((0,_extends2.default)({},ownerAndRepo,{pull_number:context.issue.number,reviewers:actualReviewers,team_reviewers:teamReviewers})));case 15:_context3.next=17;return _regenerator.default.awrap(updatePullRequestComment(megaComment,notified,reviewers,requiredReviewers));case 17:case"end":return _context3.stop();}}},null,null,null,Promise);};var runPush=function runPush(){var filesChanged,fileDiffs,notified;return _regenerator.default.async(function runPush$(_context4){while(1){switch(_context4.prev=_context4.next){case 0:_context4.next=2;return _regenerator.default.awrap(execCmd('git',['diff',context.payload.before+"..."+context.payload.after,'--name-only']));case 2:filesChanged=_context4.sent.split('\n');_context4.next=5;return _regenerator.default.awrap(getFileDiffs(context.payload.before+"..."+context.payload.after));case 5:fileDiffs=_context4.sent;notified=getNotified(filesChanged,fileDiffs,'push');_context4.next=9;return _regenerator.default.awrap(makeCommitComments(notified));case 9:case"end":return _context4.stop();}}},null,null,null,Promise);};module.exports={runPullRequest:runPullRequest,runPush:runPush};
#!/usr/bin/env node
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPush=_require.runPush;try{runPush();}catch(error){core.setFailed(error.message);}
#!/usr/bin/env node
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPullRequest=_require.runPullRequest;try{runPullRequest();}catch(error){core.setFailed(error.message);}
var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var _slicedToArray2=_interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));function _createForOfIteratorHelperLoose(o,allowArrayLike){var it;if(typeof Symbol==="undefined"||o[Symbol.iterator]==null){if(Array.isArray(o)||(it=_unsupportedIterableToArray(o))||allowArrayLike&&o&&typeof o.length==="number"){if(it)o=it;var i=0;return function(){if(i>=o.length)return{done:true};return{done:false,value:o[i++]};};}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");}it=o[Symbol.iterator]();return it.next.bind(it);}function _unsupportedIterableToArray(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen);}function _arrayLikeToArray(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i];}return arr2;}var fs=require('fs');var glob=require('glob');var _require=require('./execCmd'),execCmd=_require.execCmd;var globOptions={matchBase:true,dot:true,ignore:['node_modules/**','coverage/**','.git/**'],silent:true};var maybeAddIfMatch=function maybeAddIfMatch(pattern,name,fileDiffs,nameToFilesObj){for(var _i=0,_Object$keys=Object.keys(fileDiffs);_i<_Object$keys.length;_i++){var file=_Object$keys[_i];var diff=fileDiffs[file];if(pattern.test(diff)){if(nameToFilesObj[name]){if(!nameToFilesObj[name].includes(file)){nameToFilesObj[name].push(file);}}else{nameToFilesObj[name]=[file];}}}};var turnPatternIntoRegex=function turnPatternIntoRegex(pattern){var match=/^"\/(.*?)\/([a-z]*)"$/.exec(pattern);if(!match){throw new Error("The RegExp: "+pattern+" isn't valid");}var _match=(0,_slicedToArray2.default)(match,3),_=_match[0],regexPattern=_match[1],regexFlags=_match[2];return new RegExp(regexPattern,regexFlags);};var parseUsername=function parseUsername(original){var justName=original.match(/[^\@\!]+/);if(justName&&justName[0]){var isRequired=original.endsWith('!');return{original:original,username:"@"+justName[0],justName:justName[0],isRequired:isRequired};}throw new Error('String cannot be parsed as a name');};var pushOrSetToBin=function pushOrSetToBin(bin,username,files){if(bin[username]){for(var _iterator=_createForOfIteratorHelperLoose(files),_step;!(_step=_iterator()).done;){var file=_step.value;if(!bin[username].includes(file)){bin[username].push(file);}}}else{bin[username]=files;}};var getNotified=function getNotified(filesChanged,fileDiffs,on){var __testContent=arguments.length>3&&arguments[3]!==undefined?arguments[3]:undefined;var buf=__testContent||fs.readFileSync('.github/NOTIFIED','utf-8');var section=buf.match(on==='pull_request'?/(.|\n)*(?=^## ON PUSH WITHOUT PULL REQUEST$)/gim:/(?<=^## ON PUSH WITHOUT PULL REQUEST)(.|\n)*/gim);if(!section){throw new Error("Invalid NOTIFIED file. Could not find a line with the text: '## ON PUSH WITHOUT PULL REQUEST'. Please add the line back. This line separates the list of rules that are employed on pull-requests and on pushes to master and develop.");}var matches=section[0].match(/^[^\#\n].*/gm);var notified={};if(matches){for(var _iterator2=_createForOfIteratorHelperLoose(matches),_step2;!(_step2=_iterator2()).done;){var match=_step2.value;var untrimmedPattern=match.match(/(.(?!  @))*/);var names=match.match(/@(Khan\/)?\S*/g);if(!untrimmedPattern||!names){continue;}var pattern=untrimmedPattern[0].trim();if(pattern.startsWith('"')&&pattern.endsWith('"')){var regex=turnPatternIntoRegex(pattern);for(var _iterator3=_createForOfIteratorHelperLoose(names),_step3;!(_step3=_iterator3()).done;){var _name=_step3.value;maybeAddIfMatch(regex,_name,fileDiffs,notified);}}else{var matchedFiles=glob.sync(pattern,globOptions);var intersection=matchedFiles.filter(function(file){return filesChanged.includes(file);});for(var _iterator4=_createForOfIteratorHelperLoose(names),_step4;!(_step4=_iterator4()).done;){var _name2=_step4.value;pushOrSetToBin(notified,_name2,intersection);}}}}return notified;};var getReviewers=function getReviewers(filesChanged,fileDiffs,issuer){var __testContent=arguments.length>3&&arguments[3]!==undefined?arguments[3]:undefined;var buf=__testContent||fs.readFileSync('.github/REVIEWERS','utf-8');var matches=buf.match(/^[^\#\n].*/gm);var reviewers={};var requiredReviewers={};if(!matches){return{reviewers:reviewers,requiredReviewers:requiredReviewers};}for(var _iterator5=_createForOfIteratorHelperLoose(matches),_step5;!(_step5=_iterator5()).done;){var match=_step5.value;var untrimmedPattern=match.match(/(.(?!  @))*/);var names=match.match(/@(Khan\/)?\S*/g);if(!untrimmedPattern||!names){continue;}var pattern=untrimmedPattern[0].trim();if(pattern.startsWith('"')&&pattern.endsWith('"')){var regex=turnPatternIntoRegex(pattern);for(var _iterator6=_createForOfIteratorHelperLoose(names),_step6;!(_step6=_iterator6()).done;){var _name3=_step6.value;var _parseUsername=parseUsername(_name3),original=_parseUsername.original,username=_parseUsername.username,justName=_parseUsername.justName,isRequired=_parseUsername.isRequired;if(justName===issuer){continue;}var correctBin=isRequired?requiredReviewers:reviewers;maybeAddIfMatch(regex,username,fileDiffs,correctBin);}}else{var matchedFiles=glob.sync(pattern,globOptions);var intersection=matchedFiles.filter(function(file){return filesChanged.includes(file);});for(var _iterator7=_createForOfIteratorHelperLoose(names),_step7;!(_step7=_iterator7()).done;){var _name4=_step7.value;var _parseUsername2=parseUsername(_name4),_original=_parseUsername2.original,_username=_parseUsername2.username,_justName=_parseUsername2.justName,_isRequired=_parseUsername2.isRequired;if(_justName===issuer){continue;}var _correctBin=_isRequired?requiredReviewers:reviewers;pushOrSetToBin(_correctBin,_username,intersection);}}}return{reviewers:reviewers,requiredReviewers:requiredReviewers};};var getFilteredLists=function getFilteredLists(reviewers,requiredReviewers,notified,removedJustNames){for(var _iterator8=_createForOfIteratorHelperLoose(removedJustNames),_step8;!(_step8=_iterator8()).done;){var justName=_step8.value;var username="@"+justName;if(reviewers[username]){delete reviewers[username];}if(requiredReviewers[username]){delete requiredReviewers[username];}if(notified[username]){delete notified[username];}}var allReviewers=Object.keys(requiredReviewers).concat(Object.keys(reviewers).filter(function(reviewer){return!Object.keys(requiredReviewers).includes(reviewer);})).map(function(username){return username.slice(1);});var actualReviewers=allReviewers.filter(function(justName){return!justName.startsWith('Khan/');});var teamReviewers=allReviewers.filter(function(justName){return justName.startsWith('Khan/');}).map(function(slugWithKhan){return slugWithKhan.slice('Khan/'.length);});return{actualReviewers:actualReviewers,teamReviewers:teamReviewers};};var parseExistingComments=function parseExistingComments(existingComments){var actionBotComments=[];var removedJustNames=[];var megaComment;existingComments.data.map(function(cmnt){if(cmnt.user.login==='github-actions[bot]'){actionBotComments.push(cmnt);}else{var removeMeMatch=cmnt.body.match(/\#removeme/i);if(removeMeMatch){removedJustNames.push(cmnt.user.login);}}});actionBotComments.forEach(function(comment){var megaCommentMatch=comment.body.match(/^# Gerald/i);if(megaCommentMatch){megaComment=comment;}});return{megaComment:megaComment,removedJustNames:removedJustNames};};var getFileDiffs=function getFileDiffs(diffString){var rawDiffs,fileToDiff,_iterator9,_step9,diff,fileName;return _regenerator.default.async(function getFileDiffs$(_context){while(1){switch(_context.prev=_context.next){case 0:_context.next=2;return _regenerator.default.awrap(execCmd('git',['diff',diffString]));case 2:rawDiffs=_context.sent.split(/^diff --git /m);fileToDiff={};for(_iterator9=_createForOfIteratorHelperLoose(rawDiffs);!(_step9=_iterator9()).done;){diff=_step9.value;fileName=diff.match(/(?<=^a\/)\S*/);if(fileName){fileToDiff[fileName[0]]=diff;}}return _context.abrupt("return",fileToDiff);case 6:case"end":return _context.stop();}}},null,null,null,Promise);};var __maybeAddIfMatch=maybeAddIfMatch;var __turnPatternIntoRegex=turnPatternIntoRegex;var __parseUsername=parseUsername;var __pushOrSetToBin=pushOrSetToBin;module.exports={__maybeAddIfMatch:__maybeAddIfMatch,__turnPatternIntoRegex:__turnPatternIntoRegex,__parseUsername:__parseUsername,__pushOrSetToBin:__pushOrSetToBin,getNotified:getNotified,getReviewers:getReviewers,parseExistingComments:parseExistingComments,getFileDiffs:getFileDiffs,getFilteredLists:getFilteredLists};
