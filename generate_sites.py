import os
import markdown2
from jinja2 import Environment, FileSystemLoader

# Paths
TEMPLATE_DIR = 'templates'
CONTENT_DIR = 'content'
OUTPUT_DIR = 'docs'  # GitHub Pages default directory

# Set up Jinja2 environment
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def render_page(content_path, title):
    # Read Markdown content
    with open(content_path, 'r') as f:
        content_md = f.read()

    # Convert Markdown to HTML
    content_html = markdown2.markdown(content_md)

    # Get the base template
    template = env.get_template('base.html')

    # Render the template with the content
    html_output = template.render(title=title, content=content_html)

    return html_output

def save_output(html_output, output_path):
    with open(output_path, 'w') as f:
        f.write(html_output)

def generate_site():
    # Ensure the output directory exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Process each Markdown file in the content directory
    for filename in os.listdir(CONTENT_DIR):
        if filename.endswith('.md'):
            content_path = os.path.join(CONTENT_DIR, filename)
            output_path = os.path.join(OUTPUT_DIR, filename.replace('.md', '.html'))

            # Use the filename (without extension) as the title
            title = filename.replace('.md', '').capitalize()

            # Render and save the HTML output
            html_output = render_page(content_path, title)
            save_output(html_output, output_path)

if __name__ == "__main__":
    generate_site()
    print("Site generated successfully.")
