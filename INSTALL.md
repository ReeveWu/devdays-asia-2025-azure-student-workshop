## Create Function App

- Navigate to the `backend` directory:
  ```bash
  cd backend
  ```
- Set up the environment variables in Azure Function App (Refer to `config.template.yaml`):

  - `aiService.name`: Name of the AI Service (AI Foundry project).
  - `aiService.subscriptionKey`: Subscription key for the AI service.
- Create a `config.yaml` file based on the `config.template.yaml` and fill in the required values:
  ```bash
  cp config.template.yaml config.yaml
  ```
- Deploy the Function App:
  > [!NOTE]
  >
  > If you haven't installed azure and logged in, please install and log in first.
  >
  > If you are using Ubuntu, please follow the steps below:
  > 
  > - Install prerequisite packages
  > 
  >   ```bash
  >   sudo apt install ca-certificates curl apt-transport-https lsb-release gnupg
  >   ```
  > 
  > - Import the Microsoft signing key
  > 
  >   ```bash
  >   curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null
  >   ```
  > - Add the Azure CLI software repository
  > 
  >   ```bash
  >   AZ_REPO=$(lsb_release -cs)
  >   ```
  >   ```bash
  >   echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" | sudo tee /etc/apt/sources.list.d/azure-cli.list
  >   ```
  > 
  > - Update and install the Azure CLI
  >   ```bash
  >   sudo apt update
  >   ```
  >   ```bash
  >   sudo apt install azure-cli
  >   ```
  > 
  > - Check whether the installation is successful
  > 
  >   ```bash
  >   az version
  >   ```
  > 
  > - Login
  >   ```bash
  >   az login
  >   ```
  >   Or, If you cannot open browser in the OS (like using WSL or remoting without UI), you should use the command below:
  >   
  >   ```bash
  >   az login --use-device-code
  >   ```
  >   Then, you can open the web URL using any device with any OS and insert the device code which you just got.

  (If needed) Install necessary packages:
  ```bash
  sudo apt update | sudo apt install zip
  ```

  Run the command to deploy function app to Azure Portal.
  ```bash
  ./deploy.sh
  ```