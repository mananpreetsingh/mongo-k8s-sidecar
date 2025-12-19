# MongoDB Kubernetes Sidecar Examples

This directory contains example configurations for deploying MongoDB 8.0+ with automatic replica set management using the mongo-k8s-sidecar.

## Prerequisites

- Kubernetes cluster (1.33+)
- Storage class configured (see `storage-class-example.yaml`)
- MongoDB 8.0+ compatible sidecar image

## Quick Start

1. **Create a Storage Class** (if not already exists):
   ```bash
   kubectl apply -f storage-class-example.yaml
   ```

2. **Deploy MongoDB StatefulSet**:
   ```bash
   kubectl apply -f StatefulSet/mongo-statefulset.yaml
   ```

3. **Verify Deployment**:
   ```bash
   kubectl get statefulset mongo
   kubectl get pods -l app=mongo
   ```

4. **Check Replica Set Status**:
   ```bash
   kubectl exec -it mongo-0 -- mongosh --eval "rs.status()"
   ```

## Configuration

### Required Environment Variables

- `MONGO_SIDECAR_POD_LABELS`: Comma-separated pod labels (e.g., `app=mongo`)
- `KUBERNETES_MONGO_SERVICE_NAME`: Name of the headless service (`mongo`)

**Note:** `KUBE_NAMESPACE` is optional - the sidecar auto-detects the namespace from pod metadata.

### Storage Class

Update the `storageClassName` in `StatefulSet/mongo-statefulset.yaml` to match your storage class name. See `storage-class-example.yaml` for cloud provider configurations (AWS, Azure, GCP, Minikube).

## Connection

Connect to the replica set using the service name (MongoDB will discover all members):

```
mongodb://mongo.<namespace>.svc.cluster.local:27017/?replicaSet=rs0
```

## Scaling

Scale the replica set:

```bash
kubectl scale statefulset mongo --replicas=5
```

The sidecar automatically adds new members to the replica set.

## Troubleshooting

- Check sidecar logs: `kubectl logs <pod-name> -c mongo-sidecar`
- Check MongoDB logs: `kubectl logs <pod-name> -c mongo`
- Verify replica set: `kubectl exec -it mongo-0 -- mongosh --eval "rs.status()"`
