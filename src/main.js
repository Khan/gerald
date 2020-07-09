var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var _extends2=_interopRequireDefault(require("@babel/runtime/helpers/extends"));function _createForOfIteratorHelperLoose(o,allowArrayLike){var it;if(typeof Symbol==="undefined"||o[Symbol.iterator]==null){if(Array.isArray(o)||(it=_unsupportedIterableToArray(o))||allowArrayLike&&o&&typeof o.length==="number"){if(it)o=it;var i=0;return function(){if(i>=o.length)return{done:true};return{done:false,value:o[i++]};};}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");}it=o[Symbol.iterator]();return it.next.bind(it);}function _unsupportedIterableToArray(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen);}function _arrayLikeToArray(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i];}return arr2;}var path=require('path');var octokit=require('@actions/github');var _require=require('./utils'),getReviewers=_require.getReviewers,getNotified=_require.getNotified,getFileDiffs=_require.getFileDiffs,parseExistingComments=_require.parseExistingComments,getFilteredLists=_require.getFilteredLists;var _require2=require('./execCmd'),execCmd=_require2.execCmd;var khanActionsBot=new octokit.Github(process.env['KHAN_ACTIONS_BOT_TOKEN']);var github=new octokit.Github(process.env['GITHUB_TOKEN']);var context=octokit.context;var ownerAndRepo={owner:context.issue.owner,repo:context.issue.repo};var separator='__________________________________________________________________________________________________________________________________';var makeCommentBody=function makeCommentBody(peopleToFiles,sectionHeader){var names=Object.keys(peopleToFiles);if(names.length){var body="### "+sectionHeader;names.forEach(function(person){var files=peopleToFiles[person];body+=person+" for changes to `"+files.join('`, `')+"`\n\n";});return body;}return'';};var updatePullRequestComment=function updatePullRequestComment(comment,notifyees,reviewers,requiredReviewers){var body;return _regenerator.default.async(function updatePullRequestComment$(_context){while(1){switch(_context.prev=_context.next){case 0:body='# Gerald:\n\n';body+=makeCommentBody(notifyees,'Notified:\n');body+=makeCommentBody(reviewers,'Reviewers:\n');body+=makeCommentBody(requiredReviewers,'Required reviewers:\n');if(!body.match(/^### (Reviewers:|Required Reviewers:|Notified:)$/m)){_context.next=16;break;}body+="\n"+separator+"\n_Don't want to be involved in this pull request? Comment `#removeme` and we won't notify you of further changes._";console.log(body);if(!comment){_context.next=12;break;}_context.next=10;return _regenerator.default.awrap(github.issues.updateComment((0,_extends2.default)({},ownerAndRepo,{comment_id:comment.id,body:body})));case 10:_context.next=14;break;case 12:_context.next=14;return _regenerator.default.awrap(github.issues.createComment((0,_extends2.default)({},ownerAndRepo,{issue_number:context.issue.number,body:body})));case 14:_context.next=19;break;case 16:if(!comment){_context.next=19;break;}_context.next=19;return _regenerator.default.awrap(github.issues.deleteComment((0,_extends2.default)({},ownerAndRepo,{comment_id:comment.id})));case 19:case"end":return _context.stop();}}},null,null,null,Promise);};var makeCommitComments=function makeCommitComments(peopleToFiles){var names,body,_iterator,_step,commit;return _regenerator.default.async(function makeCommitComments$(_context2){while(1){switch(_context2.prev=_context2.next){case 0:names=Object.keys(peopleToFiles);if(!(peopleToFiles&&names.length)){_context2.next=11;break;}body='Notify of Push Without Pull Request\n\n';names.forEach(function(person){var files=peopleToFiles[person];body+=person+" for changes to `"+files.join('`, `')+"`\n";});_iterator=_createForOfIteratorHelperLoose(context.payload.commits);case 5:if((_step=_iterator()).done){_context2.next=11;break;}commit=_step.value;_context2.next=9;return _regenerator.default.awrap(khanActionsBot.repos.createCommitComment((0,_extends2.default)({},ownerAndRepo,{commit_sha:commit.id,body:body})));case 9:_context2.next=5;break;case 11:case"end":return _context2.stop();}}},null,null,null,Promise);};var runPullRequest=function runPullRequest(){var filesChanged,fileDiffs,notified,_getReviewers,reviewers,requiredReviewers,existingComments,_parseExistingComment,megaComment,removedJustNames,_getFilteredLists,actualReviewers,teamReviewers;return _regenerator.default.async(function runPullRequest$(_context3){while(1){switch(_context3.prev=_context3.next){case 0:_context3.next=2;return _regenerator.default.awrap(execCmd('git',['diff','origin/'+context.payload.pull_request.base.ref,'--name-only']));case 2:filesChanged=_context3.sent.split('\n');_context3.next=5;return _regenerator.default.awrap(getFileDiffs('origin/'+context.payload.pull_request.base.ref));case 5:fileDiffs=_context3.sent;notified=getNotified(filesChanged,fileDiffs,'pull_request');_getReviewers=getReviewers(filesChanged,fileDiffs,context.payload.pull_request.user.login),reviewers=_getReviewers.reviewers,requiredReviewers=_getReviewers.requiredReviewers;_context3.next=10;return _regenerator.default.awrap(github.issues.listComments((0,_extends2.default)({},ownerAndRepo,{issue_number:context.issue.number})));case 10:existingComments=_context3.sent;_parseExistingComment=parseExistingComments(existingComments),megaComment=_parseExistingComment.megaComment,removedJustNames=_parseExistingComment.removedJustNames;_getFilteredLists=getFilteredLists(reviewers,requiredReviewers,notified,removedJustNames),actualReviewers=_getFilteredLists.actualReviewers,teamReviewers=_getFilteredLists.teamReviewers;_context3.next=15;return _regenerator.default.awrap(khanActionsBot.pulls.createReviewRequest((0,_extends2.default)({},ownerAndRepo,{pull_number:context.issue.number,reviewers:actualReviewers,team_reviewers:teamReviewers})));case 15:_context3.next=17;return _regenerator.default.awrap(updatePullRequestComment(megaComment,notified,reviewers,requiredReviewers));case 17:case"end":return _context3.stop();}}},null,null,null,Promise);};var runPush=function runPush(){var filesChanged,fileDiffs,notified;return _regenerator.default.async(function runPush$(_context4){while(1){switch(_context4.prev=_context4.next){case 0:_context4.next=2;return _regenerator.default.awrap(execCmd('git',['diff',context.payload.before+"..."+context.payload.after,'--name-only']));case 2:filesChanged=_context4.sent.split('\n');_context4.next=5;return _regenerator.default.awrap(getFileDiffs(context.payload.before+"..."+context.payload.after));case 5:fileDiffs=_context4.sent;notified=getNotified(filesChanged,fileDiffs,'push');_context4.next=9;return _regenerator.default.awrap(makeCommitComments(notified));case 9:case"end":return _context4.stop();}}},null,null,null,Promise);};module.exports={runPullRequest:runPullRequest,runPush:runPush};