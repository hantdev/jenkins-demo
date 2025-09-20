# 🚀 MinIO + Nexus với S3 Backend

## 📋 Deploy MinIO (Bitnami Chart)
```bash
# Add repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Deploy MinIO
helm upgrade --install minio bitnami/minio \
  --namespace minio-system \
  --values minio-values.yaml \
  --create-namespace
```

## 📋 Deploy Nexus
```bash
# Create namespace
kubectl create namespace nexus

# Deploy Nexus
kubectl apply -f nexus-s3-config.yaml
```

## 🔧 Cấu hình MinIO cho Nexus
```bash
# Install MinIO client
brew install minio/stable/mc  # macOS
# hoặc
wget https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && sudo mv mc /usr/local/bin/

# Configure client (sử dụng NodePort)
mc alias set minio-local http://<NODE_IP>:30502 minioadmin minioadmin123

# Create bucket và user
mc mb minio-local/nexus-docker
mc admin user add minio-local nexus-user nexus-password123
```

## 🌐 Truy cập
```bash
# MinIO Console (NodePort)
# http://<NODE_IP>:30503 (minioadmin/minioadmin123)

# MinIO API (NodePort)
# http://<NODE_IP>:30502

# Nexus UI
kubectl port-forward -n nexus svc/nexus 8081:8081
# http://localhost:8081 (admin/admin123)

# Nexus Docker Registry
kubectl port-forward -n nexus svc/nexus 5000:5000
# localhost:5000
```

## 📦 Sử dụng Docker Registry
```bash
# Build và push
docker build -t my-app:latest .
docker tag my-app:latest localhost:5000/my-app:latest
docker login localhost:5000 -u admin -p admin123
docker push localhost:5000/my-app:latest

# Pull
docker pull localhost:5000/my-app:latest
```