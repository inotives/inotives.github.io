#### Linux Command Essential Knowledge

##### Overview

Linux is an open source OS like Windows and Mac OSX. The merit of Linux lies with its command line interface (CLI) call `shell` for running command directly from a terminal. Linux have GUI as well, but mostly use linux as a server or some work stations and heavily uses the shell cli. Linux consist of 4 major parts:

- *Kernel* - the core that provided the basic services such as handling files, networking and other necessities services for the operating system.
- *Programs* - programs that are shipped with linux in order to run things like file manipulation, text editing, browsing, encryption, etc.. More programs can be install via shell using the install command. example of such programs: vim, nano, and more ....
- *Shell* - an user interface for typing commands, executing and display the results. by default, linux usually use a bourne shell (sh), there are other such as bourne-again shell (bash) korn shell (ksh), c shell (csh) and more...
- *The X* - GUI that provides menus, windows bar, icons, mouse supports etc for user to interact. Most popular one are GNOME and KDE.

To run the shell, you will need access them from a shell windows (Terminal, xterm, Konsole, etc...). This windows are UI that run shell on your behalf, they are not the shell.

##### System Directories and Variables

To understand more on Linux, we need to understand its system directories. Linux system directory divided into 3 part: *scope*, *category* and *application*, for example: `/usr/local/bin/curl`, where `/usr/local` is the score, `bin` is the category and `curl` is the application.
Here are some common category:
- *bin* - programs, usually in binary
- *sbin* - programs that can be run by superuser
- *lib* - libraries of code use by programs
- *etc* - configuration files for the systems
- *init.d* - config files for booting linux
- *include* - header files for programming
- *src* - source files for programming
- *www*, *html* - web pages
- *var* - files specifics to this machine, created and updated when the machine runs.

For the variables in shell, you could define and assign  them with:
```
> NEWVAR=1

# access it by
> echo $NEWVAR
```
Some variables are commonly used and usually define by shell upon login:

| variable | Usage     |
| :------------- | :------------- |
| HOME          | Your home directory. e.q. /home/toni       |
| LOGNAME       | Your Login name, e.q. toni       |
| PATH          | Your shell search path. each directory is seperated by `:` |
| PWD           | Your shell current directory |
| SHELL         | path to your current shell |
| USER          | your login name |

you could also assigning your own variable to environment variable which could be access by other programs. This is done by using export command for example: `export NEWVAR`. To list the current environment variable, use `printenv`.

##### Alias

this is a built in command which defines convenient shorthand for longer command. example: `alias la='ls -a'` which define a new command `la` that function the same as `ls -la`. Usually alias is define in your `~./bash_aliases` file if you want it to be available whenever you are logged in. use cmd `alias`


##### Input and Output

The command in linux can take in standard input by using `<` operator and output to using `>` operator. Here are how you can use it.

- command < input-file
- command > output-file :: this create or overwrite the file
- command >> output-file :: this append to the file

On shell you could redirect the output of a command into another command as their standard input by using *pipes* (`|`) for example `who | sort` which send the output of `who` into sort program which will print the list of logged in user in alphabetically.

If you want your input words to contain whitespace, use single quote (`'`) or double quote (`"`) to surround your sentence. Single quote treat the sentence as it is, and double quote you could replace them with variable on shell. for example:
```
echo "Current HOME is: $HOME" // this replace $HOME with whatever in $HOME var
```

Dollar sign + parentheses can be use to evaluate as shell command, they can also be nested, for example:
```
echo current year: $(date +%Y), next year: $(expr $(date +%Y) + 1)
```


##### Running Multiple commands

In shell, you could run multiple commands at once with the following:

- `cmd1 ; cmd2 ; cmd3` ~ this run command in sequence
- `cmd1 && cmd2 && cmd3` ~ this also run cmd in sequence but stop execution if any of them fails.
- `cmd1 || cmd2 || cmd3` ~ run command in sequence and stop once 1 is succeeded

##### Command History

In shell, you could recall previous run command by using `history`.

| Command | Usage     |
| :------------- | :------------- |
| history       | Print your command history |
| history N | print the most recent N commands in your history |
| history -c | delete your history |

you could also use up and down key to check the previously run command.
