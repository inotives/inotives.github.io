#### Managing Multiple Python in Mac

All the developers that code in python before must encounter scenario where they will need to use different version of python to code different project or testing them.
Also installing package for your development, some code base must use certain version of package in order to run. These 2 factors is main headache for all developers coding in python.
We had always wanted some version management like NVM(Node Version Management) and NPM (Node Package Management) in NodeJs. This guide will help you to setup something similar those package management in Python.


##### Prerequisite

Before jump into setup, please make sure you have the following installed in your Mac:

- [Homebrew](https://brew.sh/) - Homebrew is the package management for mac. They could be used to install alot of stuff that apple dont have. As developers that use mac, besure to install this.
- [pip](https://pip.pypa.io/en/stable/installing/) - pip is package management for Python, if your python is version 2.7.6 onward, you should have pip pre-installed.
- [pyenv](https://github.com/pyenv/pyenv/blob/master/README.md#homebrew-on-mac-os-x) - Version management for Python. Without this, you will need to manually build and make python from source which will be tedious and error prone. Get this to make your life easier.
- [virtualenv](https://virtualenv.pypa.io/en/stable/installation/) - This is the tool to create isolated python environment. What good about this is that each python project that you make, you could specify the python versions used in that project and all the packages install with pip will also be isolated for that specify python version. This make your python development more organize.

##### Setup Procedure

After you have those mentioned above installed, you could start to setup your python developments. First you will use pyenv to install any python version that you required by using the following command

```
$ pyenv install 2.7.6
```

This will install python 2.7.6 into your `/home/your-user/.pyenv/2.7.6`. Do take note of the installation path of the python you just installed.

Next, go to your project folder and create a new python project using virtualenv with this command:

```
$ virtualenv --python=/home/your-user/.pyenv/2.7.6 my_python_project
```

This will make sure your new project will use the python version that you had specify. If you omit out the `--python`, virtualenv will use the python installed in your mac.

After project is created, cd into that project. You will need to activate the python that you specify by using the following command:

```
$ source ./bin/activate
```

This will temporary set your python path to the one specify. To exit simply use this command `deactivate`

Next will use pip to install the package needed. Here is the command:

```
$ pip install <package-name>
```

All the package installed will be in the python you used in your project.

With this, your python environment set up is completed.

Happy Coding !
