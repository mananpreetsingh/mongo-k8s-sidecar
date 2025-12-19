# Mongo Kubernetes Replica Set Sidecar - Mongo 8.0+ compatible

A Kubernetes sidecar container that automatically manages MongoDB replica set configuration in Kubernetes clusters.

This version is **fully compatible with MongoDB 8.0+** and uses modern Node.js and MongoDB drivers.

## Features

- ✅ **MongoDB 8.0+ Compatible** - Uses MongoDB driver 7.x with modern wire protocol
- ✅ **Automatic Replica Set Initialization** - Automatically initializes replica sets when pods start
- ✅ **Dynamic Member Management** - Automatically adds/removes members as pods scale up or down
- ✅ **Stable Network IDs** - Uses Kubernetes StatefulSet DNS names for reliable member identification
- ✅ **Health Monitoring** - Automatically removes unhealthy members from replica sets
- ✅ **Modern Stack** - Built with Node.js 24, MongoDB driver 7.x, and Kubernetes client 1.x

## Compatibility Matrix

| MongoDB Version | Status | Notes |
|----------------|--------|-------|
| 8.2+ | ✅ Fully Tested | Recommended version |
| 8.1 | ✅ Fully Tested | Fully supported |
| 8.0 | ✅ Fully Tested | Fully supported |
| 7.0 - 7.x | ⚠️ May Work | Not tested, may require adjustments |
| 6.0 - 6.x | ⚠️ May Work | Not tested, may require adjustments |
| < 6.0 | ❌ Not Supported | Uses features not available in older versions |

## Requirements

- Kubernetes cluster (1.33+)
- MongoDB 8.0+ (see Compatibility Matrix above)
- Node.js 24+ (in container)

## Installation

### Using Docker

```bash
docker pull manansingh/mongo-k8s-sidecar:1.0.0
```

## Usage

See the [example directory](example/) for complete, ready-to-use StatefulSet configurations.

Quick start:
```bash
kubectl apply -f example/StatefulSet/mongo-statefulset.yaml
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

To enable SSL/TLS, configure MongoDB with SSL flags and set the sidecar environment variables:
- `MONGO_SSL_ENABLED=true`
- `MONGO_SSL_ALLOW_INVALID_CERTIFICATES=true` (for self-signed certificates)
- `MONGO_SSL_ALLOW_INVALID_HOSTNAMES=true` (if certificate hostnames don't match)

See the [example directory](example/) for complete SSL configuration examples.

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


## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

**Manan Singh**

- GitHub: [@mananpreetsingh](https://github.com/mananpreetsingh)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on [GitHub](https://github.com/mananpreetsingh/mongo-k8s-sidecar/issues).

If you find this project helpful, consider supporting development:

<div align="center">

<a href="https://ko-fi.com/imsingh">
  <img src="https://cdn.ko-fi.com/cdn/kofi1.png" alt="Support Us" height="50" />
</a>

</div>
