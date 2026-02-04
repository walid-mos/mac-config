---
name: docker-swarm
description: Docker Swarm orchestration, troubleshooting, and best practices. Use when deploying stacks, managing services, troubleshooting swarm clusters, configuring networks/volumes, or diagnosing node/service failures. Covers swarm init, service scaling, rolling updates, secrets management, and production deployment patterns.
---

# Docker Swarm Orchestration & Troubleshooting

Comprehensive guide for managing Docker Swarm clusters in production environments.

## When to Use This Skill

Use this skill when:
- Initializing or managing a Docker Swarm cluster
- Deploying or updating service stacks
- Troubleshooting service failures, replicas not starting, or networking issues
- Configuring secrets, configs, networks, or volumes
- Scaling services or performing rolling updates
- Investigating node health or cluster connectivity
- Setting up high availability and load balancing

## Core Commands Reference

### Cluster Management

```bash
# Initialize swarm (manager node)
docker swarm init --advertise-addr <MANAGER_IP>

# Join as worker
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377

# Join as manager
docker swarm join --token <MANAGER_TOKEN> <MANAGER_IP>:2377

# Get join tokens
docker swarm join-token worker
docker swarm join-token manager

# Rotate tokens (security)
docker swarm join-token --rotate worker
docker swarm join-token --rotate manager

# Leave swarm
docker swarm leave          # Worker
docker swarm leave --force  # Manager
```

### Node Management

```bash
# List nodes
docker node ls

# Inspect node
docker node inspect <NODE_ID>
docker node inspect --pretty <NODE_ID>

# Update node availability
docker node update --availability drain <NODE_ID>    # Maintenance
docker node update --availability active <NODE_ID>   # Resume
docker node update --availability pause <NODE_ID>    # Stop new tasks

# Add labels for placement
docker node update --label-add env=production <NODE_ID>
docker node update --label-add ssd=true <NODE_ID>

# Promote/demote
docker node promote <NODE_ID>   # Worker -> Manager
docker node demote <NODE_ID>    # Manager -> Worker

# Remove node (from manager)
docker node rm <NODE_ID>
docker node rm --force <NODE_ID>
```

### Service Management

```bash
# Create service
docker service create --name myapp --replicas 3 -p 8080:80 nginx:alpine

# List services
docker service ls

# Service details
docker service inspect --pretty <SERVICE>
docker service ps <SERVICE>        # Task status
docker service logs <SERVICE>      # Aggregated logs
docker service logs -f <SERVICE>   # Follow logs

# Scale service
docker service scale myapp=5
docker service update --replicas 10 myapp

# Update service (rolling)
docker service update --image nginx:1.25 myapp
docker service update --update-parallelism 2 --update-delay 10s myapp

# Rollback
docker service rollback myapp

# Remove service
docker service rm <SERVICE>
```

### Stack Management

```bash
# Deploy stack
docker stack deploy -c docker-compose.yml mystack

# List stacks
docker stack ls

# Stack services
docker stack services mystack

# Stack tasks
docker stack ps mystack

# Remove stack
docker stack rm mystack
```

## Stack File (docker-compose.yml for Swarm)

```yaml
version: "3.8"

services:
  web:
    image: nginx:alpine
    deploy:
      replicas: 3
      placement:
        constraints:
          - node.role == worker
          - node.labels.env == production
        preferences:
          - spread: node.labels.datacenter
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
        reservations:
          cpus: "0.1"
          memory: 64M
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      labels:
        - "traefik.enable=true"
    ports:
      - target: 80
        published: 8080
        protocol: tcp
        mode: ingress  # or host
    networks:
      - frontend
    volumes:
      - web-data:/var/www/html
    secrets:
      - my_secret
    configs:
      - source: nginx_config
        target: /etc/nginx/nginx.conf

  db:
    image: postgres:15-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.db == true
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - db-data:/var/lib/postgresql/data
    secrets:
      - db_password
    networks:
      - backend

networks:
  frontend:
    driver: overlay
    attachable: true
  backend:
    driver: overlay
    internal: true  # No external access

volumes:
  web-data:
    driver: local
  db-data:
    driver: local

secrets:
  my_secret:
    external: true
  db_password:
    file: ./secrets/db_password.txt

configs:
  nginx_config:
    file: ./nginx.conf
```

## Secrets Management

```bash
# Create secret from file
docker secret create db_password ./password.txt

# Create secret from stdin
echo "mypassword" | docker secret create db_password -

# List secrets
docker secret ls

# Inspect secret (metadata only)
docker secret inspect db_password

# Use in service
docker service create \
  --name myapp \
  --secret db_password \
  myimage

# Inside container: /run/secrets/db_password
```

## Network Configuration

```bash
# Create overlay network
docker network create --driver overlay --attachable mynetwork

# Create encrypted overlay
docker network create --driver overlay --opt encrypted=true secure-net

# Create internal network (no external access)
docker network create --driver overlay --internal backend

# Inspect network
docker network inspect mynetwork

# Connect service to network
docker service update --network-add mynetwork myservice
docker service update --network-rm oldnetwork myservice
```

## Troubleshooting Workflow

### 1. Cluster Health Check

```bash
# Check all nodes
docker node ls

# Expected output - all nodes Ready, Active
# ID           HOSTNAME   STATUS   AVAILABILITY   MANAGER STATUS
# abc123 *     manager1   Ready    Active         Leader
# def456       worker1    Ready    Active
# ghi789       worker2    Ready    Active
```

### 2. Service Diagnostics

```bash
# Check service status
docker service ls
docker service ps <SERVICE> --no-trunc

# Common task states:
# Running    - Healthy
# Pending    - Waiting for resources/placement
# Rejected   - Constraint not met
# Failed     - Container crashed
# Shutdown   - Gracefully stopped

# Get task details for failed tasks
docker inspect <TASK_ID>

# Check service logs
docker service logs <SERVICE> --tail 100
docker service logs <SERVICE> 2>&1 | grep -i error
```

### 3. Common Issues & Solutions

**Service stuck in "Pending":**
```bash
# Check placement constraints
docker service inspect --pretty <SERVICE> | grep -A5 Placement

# Check node labels match constraints
docker node ls -q | xargs docker node inspect -f '{{.ID}} {{.Spec.Labels}}'

# Check resource availability
docker node ls -q | xargs -I{} docker node inspect -f '{{.ID}}: {{.Description.Resources}}' {}
```

**Replicas not starting:**
```bash
# Check task errors
docker service ps <SERVICE> --no-trunc --format "{{.Error}}"

# Common causes:
# - Image pull failure (check registry access)
# - Resource constraints (not enough CPU/memory)
# - Port already in use
# - Volume mount failure
# - Health check failing
```

**Network connectivity issues:**
```bash
# Test DNS resolution inside container
docker exec <CONTAINER> nslookup <SERVICE_NAME>

# Test connectivity
docker exec <CONTAINER> ping <SERVICE_NAME>
docker exec <CONTAINER> curl http://<SERVICE_NAME>:<PORT>

# Check network membership
docker network inspect <NETWORK> | jq '.Containers'
```

**Node not joining:**
```bash
# On the node that can't join:
# 1. Check firewall ports (2377, 7946, 4789)
# 2. Check time synchronization (NTP)
# 3. Check Docker daemon is running
# 4. Verify token is correct

# Required ports:
# TCP 2377 - Cluster management
# TCP/UDP 7946 - Node communication
# UDP 4789 - Overlay network (VXLAN)
```

### 4. Recovery Procedures

**Recover from lost quorum (managers):**
```bash
# On remaining manager
docker swarm init --force-new-cluster --advertise-addr <IP>

# Then re-add managers
```

**Force remove stuck service:**
```bash
docker service rm <SERVICE>
# If stuck, on each node:
docker container rm -f $(docker container ls -aq --filter "label=com.docker.swarm.service.name=<SERVICE>")
```

**Clean up zombie tasks:**
```bash
# Prune stopped containers
docker container prune -f

# Force update to reschedule
docker service update --force <SERVICE>
```

## Health Checks

```yaml
services:
  web:
    image: myapp
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Rolling Update Strategy

```yaml
deploy:
  update_config:
    parallelism: 2        # Update 2 at a time
    delay: 10s            # Wait between batches
    failure_action: rollback  # or pause, continue
    monitor: 60s          # Monitor period after update
    max_failure_ratio: 0.3    # 30% can fail
    order: start-first    # or stop-first
```

```bash
# Trigger update
docker service update --image myapp:v2 myservice

# Monitor update progress
watch docker service ps myservice

# Rollback if needed
docker service rollback myservice
```

## Production Best Practices

1. **High Availability**: Run 3 or 5 manager nodes (odd number for Raft consensus)
2. **Node Labels**: Use labels for placement constraints (env, datacenter, storage type)
3. **Resource Limits**: Always set CPU and memory limits
4. **Health Checks**: Define health checks for automatic recovery
5. **Secrets**: Use Docker secrets, not environment variables for sensitive data
6. **Logging**: Use logging drivers to ship logs to central location
7. **Monitoring**: Deploy monitoring stack (Prometheus + Grafana)
8. **Backups**: Regular backups of `/var/lib/docker/swarm` on managers
9. **Updates**: Use rolling updates with proper delay and parallelism
10. **Networks**: Separate overlay networks for frontend/backend isolation

## Quick Diagnostics Script

```bash
#!/bin/bash
echo "=== SWARM STATUS ==="
docker node ls

echo -e "\n=== SERVICES ==="
docker service ls

echo -e "\n=== FAILED TASKS (last 24h) ==="
docker service ls -q | xargs -I{} docker service ps {} --filter "desired-state=shutdown" --format "{{.Name}}: {{.Error}}"

echo -e "\n=== NODE RESOURCES ==="
docker node ls -q | xargs -I{} sh -c 'echo "Node: {}"; docker node inspect {} -f "CPU: {{.Description.Resources.NanoCPUs}} Memory: {{.Description.Resources.MemoryBytes}}"'
```

## Decision Framework

When diagnosing Swarm issues:
1. Is the cluster healthy? (manager quorum, node connectivity)
2. Are services defined correctly? (constraints, resources, networks)
3. Are tasks running? (check pending/failed states)
4. Is networking working? (DNS, overlay connectivity)
5. Are health checks passing? (if configured)
6. Are there resource constraints? (CPU/memory limits reached)
