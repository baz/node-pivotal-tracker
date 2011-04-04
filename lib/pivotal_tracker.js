// Pivotal Tracker API v3
var https = require('https'),
    querystring = require('querystring'),
    xml2js = require('xml2js'),
    builder = require('xmlbuilder');

function PivotalTracker(options) {
  if (!options) options = {};
  this.host = options.host || 'www.pivotaltracker.com';
  this.relativeAPIPath = '/services/v3';
  this.token = null;
}

PivotalTracker.prototype.authenticate = function(username, password, callback) {
  var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  var headers = {
    Authorization: auth
  };
  this._parsedResponse('GET', '/tokens/active', null, headers, null, function(error, response) {
    if (response !== null && response.hasOwnProperty('guid')) {
      response = response.guid;
    }
    callback(error, response);
  });
};

PivotalTracker.prototype.allProjects = function(token, callback) {
  this._parsedResponse('GET', '/projects', token, null, null, callback);
};

PivotalTracker.prototype.allMemberships = function(projectID, token, callback) {
  this._parsedResponse('GET', '/projects/' + projectID + '/memberships', token, null, null, callback);
};

PivotalTracker.prototype.addProject = function(projectName, token, callback) {
  var root = builder.begin('project');
  var ele = root.ele('name');
  ele.txt(projectName);
  var body = root.toString();
  this._parsedResponse('POST', '/projects', token, null, body, callback);
};

PivotalTracker.prototype.storiesByIteration = function(projectID, iteration, filter, offset, limit, token, callback) {
  var query = querystring.stringify({filter: filter, offset: offset, limit: limit});
  var relativePath = '/projects/' + projectID + '/iterations/' + iteration + '?' + query;
  this._parsedResponse('GET', relativePath, token, null, null, callback);
};

PivotalTracker.prototype.storiesByFilter = function(projectID, filter, offset, limit, token, callback) {
  var query = querystring.stringify({filter: filter, offset: offset, limit: limit});
  var relativePath = '/projects/' + projectID + '/stories?' + query;
  this._parsedResponse('GET', relativePath, token, null, null, callback);
};

PivotalTracker.prototype._parsedResponse = function(method, relativePath, token, opt_headers, opt_body, callback) {
  var error = null;
  var result = null;
  var headerValues = opt_headers || null;
  var contentLength = opt_body !== null ? opt_body.length : 0;
  if (!headerValues) {
    headerValues = {
      'X-TrackerToken': token,
      'Content-type': 'application/xml',
      'Content-length': contentLength
    };
  }

  var options = {
    host: this.host,
    path: this.relativeAPIPath + relativePath,
    headers: headerValues,
    method: method
  };
  var request = https.request(options, function(response) {
    var parser = new xml2js.Parser();
    if (response.statusCode != 200) {
      if (response.statusCode == 401) {
        error = 'Incorrect username/password combination.';
      } else {
        error = 'Error with HTTP status code: '+response.statusCode;
      }
    }
    parser.addListener('end', function(result) {
      callback(error, result);
    });

    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      if (error === null) {
        parser.parseString(chunk);
      } else {
        callback(error, result);
      }
    });
  }).on('error', function(error) {
      callback(error, result);
  });
  if (opt_body !== null) {
    request.write(opt_body);
  }
  request.end();
};

module.exports = PivotalTracker;
