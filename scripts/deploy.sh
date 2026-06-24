#!/bin/bash
# NEXTEP CRM - Deploy Script
# Para VPS Linux (Hetzner, DigitalOcean, etc.)

set -e

echo "🚀 Iniciando deploy do Nextep CRM..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar dependências
cd /var/www/nextep-crm/backend
npm install --production

# Criar diretório de logs
mkdir -p logs

# Configurar PM2
pm2 start server.js --name "nextep-crm" --env production
pm2 startup
pm2 save

# Configurar Nginx (opcional)
if command -v nginx &> /dev/null; then
  echo "🌐 Configurando Nginx..."
  sudo tee /etc/nginx/sites-available/nextep-crm > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    client_max_body_size 50M;
}
EOF
  sudo ln -sf /etc/nginx/sites-available/nextep-crm /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl restart nginx
fi

echo "✅ Deploy concluído!"
echo "   API: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Logs: pm2 logs nextep-crm"
