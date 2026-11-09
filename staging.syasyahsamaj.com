server {
    server_name staging.syasyahsamaj.com;

    # Proxy requests to Next.js staging app running on port 8086
    location / {
        proxy_pass http://localhost:8086;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/staging.syasyahsamaj.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/staging.syasyahsamaj.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = staging.syasyahsamaj.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name staging.syasyahsamaj.com;
    return 404; # managed by Certbot
}
