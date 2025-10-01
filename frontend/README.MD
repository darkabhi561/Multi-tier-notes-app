NOTES APP — MULTI-TIER (Frontend + Backend + MySQL)
===================================================

This project is a simple multi-tier Notes App running on Docker (without docker-compose).
It consists of:

- Frontend: Nginx serving index.html and proxying /api to backend
- Backend: Node.js (Express) REST API (/notes GET & POST)
- Database: MySQL 8.0 (data persisted in Docker volume, initialized with init.sql)

All services communicate over a custom Docker bridge network "notes-net".

---------------------------------------------------
PROJECT STRUCTURE
---------------------------------------------------

multi-notes/
├─ frontend/
│  ├─ index.html          (Static page: HTML + JS)
│  └─ default.conf        (Nginx reverse proxy config)
├─ backend/
│  ├─ package.json        (Node.js dependencies)
│  ├─ index.js            (Express app with wait-for-DB logic)
│  └─ Dockerfile          (Backend image definition)
├─ db-init/
│  └─ init.sql            (MySQL schema initialization)

---------------------------------------------------
RUNNING LOCALLY (WITHOUT DOCKER-COMPOSE)
---------------------------------------------------

1) Create Network
   docker network create notes-net

2) Start MySQL
   docker run -d --name notes-db \
     --network notes-net \
     -e MYSQL_ROOT_PASSWORD=rootpassword \
     -v notes-data:/var/lib/mysql \
     -v $(pwd)/db-init:/docker-entrypoint-initdb.d \
     mysql:8.0

3) Build & Run Backend
   cd backend
   docker build -t notes-backend .
   docker run -d --name notes-backend \
     --network notes-net \
     -e DB_HOST=notes-db \
     -e DB_USER=root \
     -e DB_PASS=rootpassword \
     -e DB_NAME=notesdb \
     notes-backend

4) Run Frontend
   docker run -d --name notes-frontend \
     --network notes-net \
     -p 8080:80 \
     -v $(pwd)/frontend/index.html:/usr/share/nginx/html/index.html \
     -v $(pwd)/frontend/default.conf:/etc/nginx/conf.d/default.conf \
     nginx:latest

5) Access App
   Open in browser: http://localhost:8080

---------------------------------------------------
USEFUL COMMANDS
---------------------------------------------------

Check logs:
  docker logs -f notes-backend

Restart containers:
  docker restart notes-db notes-backend notes-frontend

Remove everything:
  docker rm -f notes-db notes-backend notes-frontend
  docker volume rm notes-data
  docker network rm notes-net

---------------------------------------------------
DEVELOPER GUIDE
---------------------------------------------------

Running backend locally (without Docker):
  cd backend
  npm install
  DB_HOST=localhost DB_USER=root DB_PASS=rootpassword DB_NAME=notesdb node index.js
  (Requires MySQL running locally)

Debug API:
  curl http://localhost:3000/notes
  curl -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"note":"Hello"}'

---------------------------------------------------
DEVOPS / DEPLOYMENT GUIDE
---------------------------------------------------

1) Container Orchestration
   - In production, deploy using Kubernetes (Deployments + Services) or Docker Swarm.
   - The same backend/frontend images can be used anywhere.

2) Scaling Backend
   - Backend is stateless; run multiple replicas behind a load balancer.
   - Example:
     docker run -d --name notes-backend-2 \
       --network notes-net \
       -e DB_HOST=notes-db \
       -e DB_USER=root \
       -e DB_PASS=rootpassword \
       -e DB_NAME=notesdb \
       notes-backend

   - Update Nginx to load balance multiple backend containers.

3) Persistence
   - MySQL data is stored in volume "notes-data".
   - Always back up before redeployment:
     docker run --rm -v notes-data:/var/lib/mysql -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /var/lib/mysql

4) Monitoring & Health Checks
   - Backend exposes /health for readiness/liveness probes.
   - Example Docker health check:
     --health-cmd="curl -f http://localhost:3000/health || exit 1" \
     --health-interval=30s --health-retries=3

   - For production, integrate with Prometheus + Grafana to monitor containers.

5) CI/CD Suggestions
   - Use GitHub Actions or GitLab CI to:
     1. Build Docker images
     2. Push to registry (DockerHub, ECR, GCR)
     3. Deploy to staging/production automatically

---------------------------------------------------
SUMMARY
---------------------------------------------------

- Frontend (Nginx) serves static HTML and proxies API
- Backend (Node.js) handles REST API and DB logic
- MySQL database persists notes in Docker volume
- Runs without docker-compose, but ready for production with orchestration
