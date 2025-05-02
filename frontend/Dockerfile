FROM nginx:alpine

# Copy the HTML/JS/CSS files
COPY . /usr/share/nginx/html/

# Custom nginx config to handle paths and CORS
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
