var k8s = require('@kubernetes/client-node');
var config = require('./config');
var fs = require('fs');

var kc = new k8s.KubeConfig();
kc.loadFromCluster();

var k8sApi = kc.makeApiClient(k8s.CoreV1Api);

var getMongoPods = function getPods(done) {
  var namespace = config.namespace || 'default';
  var labelSelector = '';
  
  // Build label selector from config
  if (config.mongoPodLabelCollection && config.mongoPodLabelCollection.length > 0) {
    var labelParts = [];
    for (var i in config.mongoPodLabelCollection) {
      var kvp = config.mongoPodLabelCollection[i];
      labelParts.push(kvp.key + '=' + kvp.value);
    }
    labelSelector = labelParts.join(',');
  }

  k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)
    .then(function(response) {
      var pods = response.body.items || [];
      var results = [];
      
      // Filter by labels (additional check)
      var labels = config.mongoPodLabelCollection;
      for (var i in pods) {
        var pod = pods[i];
        if (!labels || podContainsLabels(pod, labels)) {
          results.push(pod);
        }
      }

      done(null, results);
    })
    .catch(function(err) {
      return done(err);
    });
};

var podContainsLabels = function podContainsLabels(pod, labels) {
  if (!pod.metadata || !pod.metadata.labels) return false;

  for (var i in labels) {
    var kvp = labels[i];
    if (!pod.metadata.labels[kvp.key] || pod.metadata.labels[kvp.key] != kvp.value) {
      return false;
    }
  }

  return true;
};

module.exports = {
  getMongoPods: getMongoPods
};
