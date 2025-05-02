# Use a lightweight Nginx image based on Alpine Linux
FROM nginx:alpine

# --- Stage 1: Prepare Clean Web Root ---
# Create a temporary stage to copy only the necessary web files
FROM alpine as web-assets
WORKDIR /app
COPY index.html .

# --- Stage 2: Final Nginx Image ---
FROM nginx:alpine

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the prepared web assets from the temporary stage
COPY --from=web-assets /app /usr/share/nginx/html/

# Expose the port Nginx listens on (defined in your nginx.conf)
EXPOSE 9002

# Start Nginx in the foreground so Docker can manage it
CMD ["nginx", "-g", "daemon off;"]
