var k8s = require('@kubernetes/client-node');
var config = require('./config');
var fs = require('fs');

var kc = new k8s.KubeConfig();
kc.loadFromCluster();

var k8sApi = kc.makeApiClient(k8s.CoreV1Api);

var getMongoPods = function getPods(done) {
  // Get namespace from env var, service account file, or default to 'default'
  var namespace = config.namespace;
  
  // If not set, try to read from service account namespace file (standard in Kubernetes)
  if (!namespace) {
    try {
      namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim();
    } catch (e) {
      // If file doesn't exist, default to 'default'
      namespace = 'default';
    }
  }
  
  // Ensure namespace is not empty
  if (!namespace || namespace === '') {
    namespace = 'default';
  }
  
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

  console.log('Looking for pods in namespace: ' + namespace);
  
  // Ensure namespace is a string (not null/undefined)
  if (!namespace || typeof namespace !== 'string') {
    return done(new Error('Namespace is required but was: ' + namespace));
  }
  
  // Build param object - new Kubernetes client requires param object with namespace property
  var param = {
    namespace: namespace
  };
  
  if (labelSelector && labelSelector !== '') {
    param.labelSelector = labelSelector;
  }
  
  
  k8sApi.listNamespacedPod(param)
    .then(function(response) {
      // New Kubernetes client returns response directly with items property
      // Response structure: { apiVersion, items, kind, metadata }
      var pods = response.items || [];
      
      if (!Array.isArray(pods)) {
        console.error('Unexpected pods structure:', typeof pods);
        return done(new Error('Pods is not an array'));
      }
      
      var results = [];
      
      // Filter by labels (additional check)
      var labels = config.mongoPodLabelCollection;
      for (var i in pods) {
        var pod = pods[i];
        if (!labels || podContainsLabels(pod, labels)) {
          results.push(pod);
        }
      }

      console.log('Found ' + results.length + ' matching pods out of ' + pods.length + ' total');
      done(null, results);
    })
    .catch(function(err) {
      console.error('Error calling listNamespacedPod:', err.message || err);
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
