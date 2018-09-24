bitcoinz-insight-patched quick install guide
================================

Get dependencies

sudo apt-get install \
      build-essential pkg-config libc6-dev m4 g++-multilib \
      autoconf libtool ncurses-dev unzip git python \
      zlib1g-dev wget bsdmainutils automake
Install

# Clone Bitcoinz Repository
git clone https://github.com/btcz/bitcoinz-insight-patched
# Build
cd bitcoinz/
./zcutil/build.sh -j$(nproc)
# fetch key
./zcutil/fetch-params.sh
# Run
./src/bitcoinzd
# Test getting information about the network
cd src/
./bitcoinz-cli getmininginfo
# Test creating new transparent address
./bitcoinz-cli getnewaddress
# Test creating new private address
./bitcoinz-cli z_getnewaddress
# Test checking transparent balance
./bitcoinz-cli getbalance
# Test checking total balance 
./bitcoinz-cli z_gettotalbalance
# Check all available wallet commands
./bitcoinz-cli help
# Get more info about a single wallet command
./bitcoinz-cli help "The-command-you-want-to-learn-more-about"
./bitcoinz-cli help "getbalance"
