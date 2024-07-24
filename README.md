# inotives.github.io

This is a static blogging sites created using Python, Jinja2 and Markdown2.
It generate the static sites by using markdown file in the content folder.
Limit the use of database.

## How to run locally
- After cloning the project, cd into the root folder and create a virtual environment
```
python3 -m venv venv
```

- Next you need to install all the required packages in the requirements.txt
```
pip install -r requirements.txt
```

- After all the require packages is installed, you can run the generator by using
```
python run_generator.py
```
This will run the static site generator and produce all the html file in the docs folder

- On your local machine, you can run the static server using Flask. The watcher will monitor all changes to .py, .md, and .html files and will re-run the generator script (generate_site.py) whenever any of these files are modified. To run the local flask server, do:
```
python run_server.py
```
