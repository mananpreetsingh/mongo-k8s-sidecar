var { MongoClient } = require('mongodb');
var config = require('./config');

var localhost = '127.0.0.1'; //Can access mongo as localhost from a sidecar

var getDb = function(host, done) {
  //If they called without host like getDb(function(err, db) { ... });
  if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      done = arguments[0];
      host = localhost;
    } else {
      throw new Error('getDb illegal invocation. User either getDb(\'options\', function(err, db) { ... }) OR getDb(function(err, db) { ... })');
    }
  }

  host = host || localhost;
  
  // Build connection string
  var authString = '';
  if (config.username && config.password) {
    authString = config.username + ':' + encodeURIComponent(config.password) + '@';
  }
  
  var connectionString = 'mongodb://' + authString + host + ':' + config.mongoPort + '/' + config.database;
  
  var mongoOptions = {
    directConnection: true, // Connect directly to this host
    serverSelectionTimeoutMS: 5000
  };

  if (config.mongoSSLEnabled) {
    mongoOptions.tls = config.mongoSSLEnabled;
    mongoOptions.tlsAllowInvalidCertificates = config.mongoSSLAllowInvalidCertificates;
    mongoOptions.tlsAllowInvalidHostnames = config.mongoSSLAllowInvalidHostnames;
  }

  var client = new MongoClient(connectionString, mongoOptions);
  
  client.connect()
    .then(function() {
      var db = client.db(config.database);
      // Store client reference for cleanup
      db._client = client;
      return done(null, db);
    })
    .catch(function(err) {
      return done(err);
    });
};

var replSetGetConfig = function(db, done) {
  db.admin().command({ replSetGetConfig: 1 })
    .then(function(results) {
      return done(null, results.config);
    })
    .catch(function(err) {
      return done(err);
    });
};

var replSetGetStatus = function(db, done) {
  db.admin().command({ replSetGetStatus: 1 })
    .then(function(results) {
      return done(null, results);
    })
    .catch(function(err) {
      return done(err);
    });
};

var initReplSet = function(db, hostIpAndPort, done) {
  console.log('initReplSet', hostIpAndPort);

  // Create initial replica set config
  var rsConfig = {
    _id: 'rs0',
    members: [
      {
        _id: 0,
        host: hostIpAndPort
      }
    ]
  };
  
  if (config.isConfigRS) {
    rsConfig.configsvr = true;
  }

  db.admin().command({ replSetInitiate: rsConfig })
    .then(function() {
      console.log('Replica set initiated successfully');
      return done();
    })
    .catch(function(err) {
      // If already initialized, that's OK
      if (err.code === 23 || err.codeName === 'AlreadyInitialized') {
        console.log('Replica set already initialized, continuing...');
        return done();
      }
      return done(err);
    });
};

var replSetReconfig = function(db, rsConfig, force, done) {
  rsConfig.version++;
  
  console.log('Applying replica set reconfig (version ' + rsConfig.version + ', force: ' + force + ')');
  console.log('  Members:');
  for (var i = 0; i < rsConfig.members.length; i++) {
    console.log('    - ' + rsConfig.members[i].host);
  }

  db.admin().command({ replSetReconfig: rsConfig, force: force })
    .then(function() {
      console.log('Replica set reconfig completed successfully');
      return done();
    })
    .catch(function(err) {
      console.error('Replica set reconfig failed:', err.message || err);
      return done(err);
    });
};

var addNewReplSetMembers = function(db, addrToAdd, addrToRemove, shouldForce, done) {
  replSetGetConfig(db, function(err, rsConfig) {
    if (err) {
      console.error('Failed to get replica set config:', err.message || err);
      return done(err);
    }

    var beforeCount = rsConfig.members ? rsConfig.members.length : 0;
    removeDeadMembers(rsConfig, addrToRemove);
    addNewMembers(rsConfig, addrToAdd);
    var afterCount = rsConfig.members ? rsConfig.members.length : 0;

    if (beforeCount !== afterCount) {
      console.log('Reconfiguring replica set: ' + beforeCount + ' -> ' + afterCount + ' members');
    }

    replSetReconfig(db, rsConfig, shouldForce, done);
  });
};

var addNewMembers = function(rsConfig, addrsToAdd) {
  if (!addrsToAdd || !addrsToAdd.length) return;

  var memberIds = [];
  var newMemberId = 0;

  // Build a list of existing rs member IDs
  for (var i in rsConfig.members) {
    memberIds.push(rsConfig.members[i]._id);
  }

  for (var i in addrsToAdd) {
    var addrToAdd = addrsToAdd[i];

    // Search for the next available member ID (max 255)
    for (var i = newMemberId; i <= 255; i++) {
      if (!memberIds.includes(i)) {
        newMemberId = i;
        memberIds.push(newMemberId);
        break;
      }
    }

    // Somehow we can get a race condition where the member config has been updated since we created the list of
    // addresses to add (addrsToAdd) ... so do another loop to make sure we're not adding duplicates
    var exists = false;
    for (var j in rsConfig.members) {
      var member = rsConfig.members[j];
      if (member.host === addrToAdd) {
        console.log("Host [%s] already exists in the Replicaset. Not adding...", addrToAdd);
        exists = true;
        break;
      }
    }

    if (exists) {
      continue;
    }

    var cfg = {
      _id: newMemberId,
      host: addrToAdd
    };

    rsConfig.members.push(cfg);
  }
};

var removeDeadMembers = function(rsConfig, addrsToRemove) {
  if (!addrsToRemove || !addrsToRemove.length) return;

  for (var i in addrsToRemove) {
    var addrToRemove = addrsToRemove[i];
    for (var j in rsConfig.members) {
      var member = rsConfig.members[j];
      if (member.host === addrToRemove) {
        rsConfig.members.splice(j, 1);
        break;
      }
    }
  }
};

var isInReplSet = function(ip, done) {
  getDb(ip, function(err, db) {
    if (err) {
      return done(err);
    }

    replSetGetConfig(db, function(err, rsConfig) {
      // Close client connection
      if (db._client) {
        db._client.close().catch(function() {}); // Ignore close errors
      }
      if (!err && rsConfig) {
        done(null, true);
      }
      else {
        done(null, false);
      }
    });
  });
};

module.exports = {
  getDb: getDb,
  replSetGetStatus: replSetGetStatus,
  initReplSet: initReplSet,
  addNewReplSetMembers: addNewReplSetMembers,
  isInReplSet: isInReplSet
};
