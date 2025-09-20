# Hướng dẫn Deploy Jenkins trên Kubernetes

## Vấn đề đã gặp phải
Lỗi `pods is forbidden: User "system:serviceaccount:jenkins:default" cannot list resource "pods"` xảy ra vì Jenkins sử dụng ServiceAccount mặc định không có quyền tạo và quản lý pods.

## Giải pháp
Đã tạo cấu hình RBAC (Role-Based Access Control) để cấp quyền cần thiết cho Jenkins.

## Các file cấu hình

### 1. jenkins-rbac.yaml
- Tạo ServiceAccount `jenkins` 
- Tạo ClusterRole với quyền quản lý pods, deployments, services, v.v.
- Tạo ClusterRoleBinding để gán quyền cho ServiceAccount

### 2. jenkins-deployment.yaml (đã cập nhật)
- Thêm `serviceAccountName: jenkins` để sử dụng ServiceAccount có quyền

### 3. jenkins-svc.yaml
- Service chính cho Jenkins UI (NodePort 30000)
- Service JNLP cho Jenkins agents

### 4. jenkins-pvc.yaml
- PersistentVolumeClaim để lưu trữ dữ liệu Jenkins

## Cách deploy

### Bước 1: Tạo namespace
```bash
kubectl create namespace jenkins
```

### Bước 2: Deploy các file cấu hình
```bash
# Deploy RBAC trước
kubectl apply -f jenkins-rbac.yaml

# Deploy PVC
kubectl apply -f jenkins-pvc.yaml

# Deploy Service
kubectl apply -f jenkins-svc.yaml

# Deploy Jenkins
kubectl apply -f jenkins-deployment.yaml
```

### Bước 3: Kiểm tra trạng thái
```bash
# Kiểm tra pods
kubectl get pods -n jenkins

# Kiểm tra services
kubectl get svc -n jenkins

# Kiểm tra logs nếu có lỗi
kubectl logs -f deployment/jenkins -n jenkins
```

### Bước 4: Truy cập Jenkins
- URL: `http://<node-ip>:30000`
- Lấy password admin ban đầu:
```bash
kubectl exec -it deployment/jenkins -n jenkins -- cat /var/jenkins_home/secrets/initialAdminPassword
```

## Cấu hình Jenkins cho Kubernetes

### 1. Cài đặt Kubernetes Plugin
- Manage Jenkins > Manage Plugins > Available
- Tìm và cài đặt "Kubernetes" plugin

### 2. Cấu hình Kubernetes Cloud
- Manage Jenkins > Manage Nodes and Clouds > Configure Clouds
- Add a new cloud > Kubernetes
- Kubernetes URL: `https://kubernetes.default.svc.cluster.local`
- Kubernetes Namespace: `jenkins`
- Credentials: Chọn "Kubernetes service account" (tự động detect)

### 3. Test pipeline
Sử dụng Jenkinsfile-demo đã có để test pipeline với Kubernetes agents.

## Troubleshooting

### Kiểm tra quyền ServiceAccount
```bash
kubectl auth can-i list pods --as=system:serviceaccount:jenkins:jenkins -n jenkins
```

### Kiểm tra logs Jenkins
```bash
kubectl logs -f deployment/jenkins -n jenkins
```

### Restart Jenkins nếu cần
```bash
kubectl rollout restart deployment/jenkins -n jenkins
```

## Lưu ý
- Đảm bảo cluster có StorageClass `local-path` hoặc thay đổi trong jenkins-pvc.yaml
- Nếu sử dụng Minikube, cần enable addon: `minikube addons enable storage-provisioner`
- Đảm bảo Docker socket được mount đúng cách cho Docker-in-Docker
