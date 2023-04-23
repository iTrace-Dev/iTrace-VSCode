# iTrace-VSCode
## Using iTrace-VSCode
There are two options to use iTrace-VSCode. VSCode's extension API does not provide access to the underlying DOM information, iTrace-VSCode must be loaded in as JavaScript into VSCode's DOM.
### VSCode DevTools
The first option to use iTrace-VSCode is to load it directly into the DevTools console.
* Download the `itrace.js` file, and copy its contents
* Open VSCode
* Open iTrace-Core
* Open the DevTools console window by going to Help->Toogle Developer Tools->Console
* Paste the code into the console and press `Enter`
If no errors appear in the console, you should be good to go. You may close the DevTools window or leave it open for debugging, and you can set iTrace-Core up and beging tracking when ready.
### Custom CSS and JS Loader
The second option is to use a VSCode Extension, [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
* Follow the steps on the Extension's page
* When it has you add files in `settings.json`, add the path to `itrace.js`
* After setting up the extension, make sure to have iTrace-Core open before launching VSCode
To track errors using this method, open the DevTools window's console.
## Acknowledgements
Special thanks to [@toBeOfUse](https://github.com/toBeOfUse) for their [vscode-scanner](https://github.com/toBeOfUse/vscode-scanner) repo, which formed the base of this project!
