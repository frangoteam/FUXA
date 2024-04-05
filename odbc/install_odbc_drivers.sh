#!/bin/bash

# Install curl and cat if not already installed
apt-get update && \
apt-get install -y --no-install-recommends \
    curl \
    cat 

# Detect Debian version
debian_version=$(cat /etc/os-release | grep VERSION_ID | sed 's/VERSION_ID=//' | tr -d '"')

# Choose appropriate package URL based on Debian version
case $debian_version in
    9)
        package_url="https://packages.microsoft.com/config/debian/9/prod.list"
        ;;
    10)
        package_url="https://packages.microsoft.com/config/debian/10/prod.list"
        ;;
    11)
        package_url="https://packages.microsoft.com/config/debian/11/prod.list"
        ;;
    12)
        package_url="https://packages.microsoft.com/config/debian/12/prod.list"
        ;;
    *)
        echo "Unsupported Debian version: $debian_version"
        exit 1
        ;;
esac

# Download appropriate package for the OS version
curl "$package_url" | tee /etc/apt/sources.list.d/mssql-release.list

# Install necessary packages for ODBC drivers
apt-get install -y --no-install-recommends \
    unixodbc \
    unixodbc-dev \
    libmyodbc \
    odbc-postgresql \
    libsqliteodbc \
    freetds-dev \
    freetds-bin \
    tdsodbc

# Install Microsoft SQL Server ODBC Driver 18
ACCEPT_EULA=Y apt-get install -y msodbcsql18

# Clean up apt cache
apt-get clean && rm -rf /var/lib/apt/lists/*
