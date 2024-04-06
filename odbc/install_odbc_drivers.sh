#!/bin/bash

# Function to check system architecture
get_architecture() {
    arch=$(dpkg --print-architecture)
    case $arch in
        amd64) echo "x64";;
        arm64) echo "arm64";;
        i386) echo "x86";;
        armhf) echo "armhf";;
        *) echo "Unsupported architecture: $arch"; exit 1;;
    esac
}

# Function to check Debian version
get_debian_version() {
    version=$(grep VERSION_ID /etc/os-release | cut -d '=' -f 2)
    # Trim leading and trailing whitespace
    version=$(echo "${version}" | sed -e 's/^"//' -e 's/"$//')
    echo "$version"
}

# Install necessary packages for ODBC drivers
apt-get update && \
apt-get install -y \
    curl \
    wget \
    unixodbc \
    unixodbc-dev \
    odbc-postgresql \
    libsqliteodbc \
    freetds-dev \
    freetds-bin \
    tdsodbc \
    libssl1.1 \
    libssl-dev \
    apt-transport-https

# Add Microsoft GPG key
curl https://packages.microsoft.com/keys/microsoft.asc | tee /etc/apt/trusted.gpg.d/microsoft.asc

# Detect system architecture and Debian version
architecture=$(get_architecture)
debian_version=$(get_debian_version)

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

# Check architecture and Debian version
if [ "$architecture" == "x64" ] || [ "$architecture" == "x86" ]; then
    echo "Package URL: $package_url "
    # Download appropriate package for the OS version
    curl $package_url | tee /etc/apt/sources.list.d/mssql-release.list

    # Update apt package index
    apt-get update

    # Install Microsoft SQL Server ODBC Driver 18
    ACCEPT_EULA=Y apt-get install -y msodbcsql18

elif [ "$architecture" == "arm64" ] && [ "$debian_version" -ge 11 ]; then
    echo "Package URL: $package_url "
    # Download appropriate package for the OS version
    curl $package_url | tee /etc/apt/sources.list.d/mssql-release.list

    # Update apt package index
    apt-get update

    # Install Microsoft SQL Server ODBC Driver 18
    ACCEPT_EULA=Y apt-get install -y msodbcsql18
else
    echo "MS SQL ODBC driver installation skipped due to unsupported architecture or Debian version."
    echo "Architecture: $architecture"
    echo "Debian Version: $debian_version"
fi

# Check if /usr/lib/odbc/ directory exists, if not, create it
echo "Check if /usr/lib/odbc/ directory exists, if not, create it"
if [ ! -d "/usr/lib/odbc/" ]; then
    mkdir -p "/usr/lib/odbc/"
    echo "mkdir /usr/lib/odbc/"
fi

# Move ODBC driver files based on system architecture
echo "Move ODBC driver files based on system architecture"
if [ "$architecture" == "arm64" ]; then
    # Copy the entire directory to /usr/lib/odbc/
    cp -r /usr/lib/aarch64-linux-gnu/odbc/* /usr/lib/odbc/
elif [ "$architecture" == "armhf" ]; then
    # Copy the entire directory to /usr/lib/odbc/
    cp -r /usr/lib/arm-linux-gnueabihf/odbc/* /usr/lib/odbc/
elif [ "$architecture" == "x64" ] || [ "$architecture" == "x86" ]; then
    # Copy the entire directory to /usr/lib/odbc/
    cp -r /usr/lib/x86_64-linux-gnu/odbc/* /usr/lib/odbc/
else
    echo "Move ODBC driver files Unsupported architecture: $architecture"
    exit 1
fi

# Continue with MySQL ODBC Driver installation
echo "Downloading MySQL ODBC Driver..."
if [ "$architecture" == "arm64" ]; then
    # Download MySQL ODBC Driver for ARM
    wget -q "https://dev.mysql.com/get/Downloads/Connector-ODBC/8.3/mysql-connector-odbc-8.3.0-linux-glibc2.28-aarch64.tar.gz" -O mysql-connector-odbc.tar.gz
elif [ "$architecture" == "x64" ] || [ "$architecture" == "x86" ]; then
    # Download MySQL ODBC Driver for x64
    wget -q "https://dev.mysql.com/get/Downloads/Connector-ODBC/8.3/mysql-connector-odbc-8.3.0-linux-glibc2.28-x86-64bit.tar.gz" -O mysql-connector-odbc.tar.gz
else
    echo "MySQL ODBC Driver Unsupported architecture: $architecture"
    exit 1
fi

# Extracting MySQL ODBC Driver
echo "Extracting MySQL ODBC Driver..."
tar -xzf mysql-connector-odbc.tar.gz

# Install the extracted driver
cd mysql-connector-odbc-*
cp -r bin/* /usr/local/bin
cp -r lib/* /usr/local/lib

# Register the driver
echo "Registering MySQL ODBC Driver..."
myodbc-installer -a -d -n "MySQL ODBC 8.3 Unicode Driver" -t "Driver=/usr/local/lib/libmyodbc8w.so"
myodbc-installer -a -d -n "MySQL ODBC 8.3 ANSI Driver" -t "Driver=/usr/local/lib/libmyodbc8a.so"

# Copy libmyodbc8*.so to odbc drivers
cp /usr/local/lib/libmyodbc8a.so /usr/lib/odbc/libmyodbc8a.so
cp /usr/local/lib/libmyodbc8w.so /usr/lib/odbc/libmyodbc8w.so

# Verify that the driver is installed and registered
echo "Verifying driver installation..."
/usr/local/bin/myodbc-installer -d -l

# Clean up extracted files
rm -rf mysql-connector-odbc-*
rm -f mysql-connector-odbc.tar.gz

# Clean up apt cache
apt-get clean && rm -rf /var/lib/apt/lists/*

