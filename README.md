#  Mongo Kubernetes Sidecar - Mongo 8.0+ compatible

A Kubernetes sidecar container that automatically manages MongoDB replica set configuration in Kubernetes clusters. This version is **fully compatible with MongoDB 8.0+** and uses modern Node.js and MongoDB drivers.

## Features

- ✅ **MongoDB 8.0+ Compatible** - Uses MongoDB driver 7.x with modern wire protocol
- ✅ **Automatic Replica Set Initialization** - Automatically initializes replica sets when pods start
- ✅ **Dynamic Member Management** - Automatically adds/removes members as pods scale up or down
- ✅ **Stable Network IDs** - Uses Kubernetes StatefulSet DNS names for reliable member identification
- ✅ **Health Monitoring** - Automatically removes unhealthy members from replica sets
- ✅ **Modern Stack** - Built with Node.js 24, MongoDB driver 7.x, and Kubernetes client 1.x

## Requirements

- Kubernetes cluster (1.33+)
- MongoDB 8.0+ (tested with MongoDB 8.0+)
- Node.js 24+ (in container)

## How It Works

The sidecar container runs alongside your MongoDB container and:

1. **Discovers MongoDB pods** in the cluster using Kubernetes API
2. **Initializes replica set** if not already configured
3. **Adds new members** when pods are created or scaled up
4. **Removes unhealthy members** when pods become unhealthy or are deleted
5. **Uses stable DNS names** from StatefulSets for reliable member identification

## Installation

### Using Docker

```bash
docker pull manansingh/mongo-k8s-sidecar:1.0.0
```

### Building from Source

**For local development:**
```bash
git clone https://github.com/mananpreetsingh/mongo-k8s-sidecar.git
cd mongo-k8s-sidecar
npm install
docker build -t mongo-k8s-sidecar:1.0.0 .
```

**For Kubernetes deployment (AMD64/x86_64):**
```bash
git clone https://github.com/mananpreetsingh/mongo-k8s-sidecar.git
cd mongo-k8s-sidecar
npm install

# Build for AMD64 platform (required for most Kubernetes clusters)
docker build --platform linux/amd64 -t manansingh/mongo-k8s-sidecar:1.0.0 .

# Tag as latest
docker tag manansingh/mongo-k8s-sidecar:1.0.0 manansingh/mongo-k8s-sidecar:latest

# Login to Docker Hub
docker login

# Push to Docker Hub
docker push manansingh/mongo-k8s-sidecar:1.0.0
docker push manansingh/mongo-k8s-sidecar:latest
```

**Note:** If building on Apple Silicon (M1/M2/M3), you must use `--platform linux/amd64` to ensure compatibility with most Kubernetes clusters.

### Automated Builds with GitHub Actions

This repository includes a GitHub Actions workflow that automatically builds and pushes Docker images to Docker Hub on:
- Push to `main` or `master` branch
- Creation of version tags (e.g., `v1.0.0`)
- Manual workflow dispatch

**Setup:**
1. Go to your repository Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `DOCKER_USERNAME`: Your Docker Hub username (`manansingh`)
   - `DOCKER_PASSWORD`: Your Docker Hub access token (create one at https://hub.docker.com/settings/security)

**Usage:**
- Push to `main` branch → Builds and pushes `latest` tag
- Create a tag `v1.0.0` → Builds and pushes `1.0.0`, `1.0`, `1`, and `latest` tags
- Images are automatically built for `linux/amd64` platform

## Usage

### Basic StatefulSet Example

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
spec:
  serviceName: mongo
  replicas: 3
  template:
    spec:
      containers:
      - name: mongo
        image: mongo:8.2
        command:
        - mongod
        - "--bind_ip_all"
        - "--replSet"
        - rs0
        ports:
        - containerPort: 27017
        volumeMounts:
        - name: mongo-persistent-storage
          mountPath: /data/db
      - name: mongo-sidecar
        image: manansingh/mongo-k8s-sidecar:1.0.0
        env:
        - name: MONGO_SIDECAR_POD_LABELS
          value: "app=mongo"
        - name: KUBERNETES_MONGO_SERVICE_NAME
          value: mongo
        - name: KUBE_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
  volumeClaimTemplates:
  - metadata:
      name: mongo-persistent-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_SIDECAR_POD_LABELS` | **Yes** | - | Comma-separated pod labels to identify MongoDB pods (e.g., `app=mongo,env=prod`). Must match the pod template labels. |
| `KUBERNETES_MONGO_SERVICE_NAME` | **Yes** | - | Name of the Kubernetes (headless) service for MongoDB. Used for stable network IDs with StatefulSets. |
| `KUBE_NAMESPACE` | No | - | Kubernetes namespace to search for pods. If not set, searches all namespaces. |
| `KUBERNETES_CLUSTER_DOMAIN` | No | `cluster.local` | Kubernetes cluster domain name. Used for creating stable network IDs. |
| `MONGO_PORT` | No | `27017` | MongoDB port number. Allows usage of non-standard ports. |
| `MONGO_SIDECAR_SLEEP_SECONDS` | No | `5` | Sleep interval in seconds between work cycles. |
| `MONGO_SIDECAR_UNHEALTHY_SECONDS` | No | `15` | Seconds a replica set member must be unhealthy before being automatically removed. |
| `MONGODB_USERNAME` | No | - | MongoDB username for authentication. |
| `MONGODB_PASSWORD` | No | - | MongoDB password for authentication. |
| `MONGODB_DATABASE` | No | `local` | MongoDB authentication database. |
| `CONFIG_SVR` | No | `false` | Set to `true`, `yes`, `y`, or `1` to configure the replica set as a [configsvr](https://www.mongodb.com/docs/manual/reference/replica-configuration/#mongodb-rsconf-rsconf.configsvr) (for sharded clusters). |
| `MONGO_SSL_ENABLED` | No | `false` | Enable SSL/TLS for MongoDB connections. Set to `true` to enable. |
| `MONGO_SSL_ALLOW_INVALID_CERTIFICATES` | No | `false` | Allow self-signed or invalid SSL certificates. Set to `true` to allow. |
| `MONGO_SSL_ALLOW_INVALID_HOSTNAMES` | No | `false` | Allow SSL certificates with hostnames that don't match. Set to `true` to allow. |

## How It Works

1. **Pod Discovery**: Uses Kubernetes API to find all pods matching the specified labels
2. **Replica Set Check**: Checks if MongoDB is already part of a replica set
3. **Initialization**: If not initialized, the first pod (by IP) initializes the replica set
4. **Member Management**: Primary pod adds/removes members based on pod status
5. **Health Monitoring**: Removes members that are unhealthy for more than the configured threshold

## Stable Network IDs

The sidecar uses Kubernetes StatefulSet DNS names for member identification when `KUBERNETES_MONGO_SERVICE_NAME` is set. This provides stable, persistent identifiers for replica set members.

### Format

```
<pod-name>.<service-name>.<namespace>.svc.<cluster-domain>:<port>
```

**Example**: `mongo-0.mongo.default.svc.cluster.local:27017`

Where:
- `mongo-0` = StatefulSet name + ordinal
- `mongo` = Service name (from `KUBERNETES_MONGO_SERVICE_NAME`)
- `default` = Namespace
- `cluster.local` = Cluster domain (from `KUBERNETES_CLUSTER_DOMAIN`)

### Benefits

- **Persistent identification**: Members remain identifiable even if pod IPs change
- **DNS-based**: Uses Kubernetes DNS for reliable resolution
- **StatefulSet compatible**: Works seamlessly with Kubernetes StatefulSets

### Compatibility

The sidecar prefers stable network IDs but is compatible with replica sets configured using pod IPs. It will:
- Use stable network IDs for new members when `KUBERNETES_MONGO_SERVICE_NAME` is set
- Not modify existing members that use pod IPs
- Avoid duplicate entries for the same MongoDB instance

**Compatible replica set member names**:
- `10.48.0.72:27017` (pod IP)
- `mongo-0.mongo.default.svc.cluster.local:27017` (stable network ID)

**Incompatible names** (may cause issues):
- `mongodb-service-0` (custom service name without full DNS path)

## SSL/TLS Configuration

### Enabling SSL

To enable SSL/TLS connections to MongoDB:

```yaml
containers:
- name: mongo
  image: mongo:8.2
  command:
  - mongod
  - "--bind_ip_all"
  - "--replSet"
  - rs0
  - "--sslMode"
  - "requireSSL"
  - "--sslPEMKeyFile"
  - "/data/ssl/mongodb.pem"
  volumeMounts:
  - name: mongo-ssl
    mountPath: /data/ssl
- name: mongo-sidecar
  image: manansingh/mongo-k8s-sidecar:1.0.0
  env:
  - name: MONGO_SIDECAR_POD_LABELS
    value: "app=mongo"
  - name: KUBERNETES_MONGO_SERVICE_NAME
    value: mongo
  - name: MONGO_SSL_ENABLED
    value: "true"
  - name: MONGO_SSL_ALLOW_INVALID_CERTIFICATES
    value: "true"  # For self-signed certificates
  - name: MONGO_SSL_ALLOW_INVALID_HOSTNAMES
    value: "true"  # If certificate hostnames don't match
volumes:
- name: mongo-ssl
  secret:
    secretName: mongo-ssl-cert
```

### Creating SSL Certificates

Create a Kubernetes secret with your SSL certificate:

```bash
kubectl create secret generic mongo-ssl-cert \
  --from-file=mongodb.pem=/path/to/mongodb.pem \
  -n <namespace>
```

## Troubleshooting

### Sidecar Not Adding Members

- Check pod labels match `MONGO_SIDECAR_POD_LABELS`
- Verify `KUBERNETES_MONGO_SERVICE_NAME` matches your service name
- Check sidecar logs: `kubectl logs <pod-name> -c mongo-sidecar`

### Replica Set Not Initializing

- Ensure at least one pod is running
- Check MongoDB logs for errors
- Verify MongoDB is started with `--replSet rs0` flag

### Members Not Syncing

- Check network connectivity between pods
- Verify DNS resolution works: `nslookup mongo-0.mongo.default.svc.cluster.local`
- Check MongoDB replica set status: `rs.status()`

## Development

### Prerequisites

- Node.js 24+
- npm
- Docker

### Running Locally

```bash
npm install
npm start
```

### Testing

```bash
npm test
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

**Manan Singh**

- GitHub: [@mananpreetsingh](https://github.com/mananpreetsingh)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on [GitHub](https://github.com/mananpreetsingh/mongo-k8s-sidecar/issues).
