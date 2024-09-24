import os
import markdown2
import jinja2

# Define constants for directories
DOCS_DIR = 'docs'
TEMPLATE_DIR = 'templates'
ASSETS_DIR = os.path.join(DOCS_DIR, 'assets')

# Ensure the template directory exists
if not os.path.isdir(TEMPLATE_DIR):
    raise Exception(f"Template directory '{TEMPLATE_DIR}' does not exist.")

# Create a Jinja2 environment
env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATE_DIR))

def load_template(template_name):
    """Load a Jinja2 template."""
    try:
        template = env.get_template(template_name)
        return template
    except jinja2.exceptions.TemplateNotFound:
        raise Exception(f"Template '{template_name}' not found in '{TEMPLATE_DIR}'.")

def render_template(template, **kwargs):
    """Render a template with the given context."""
    return template.render(**kwargs)

def save_rendered_content(content, output_path):
    """Save the rendered content to a file."""
    with open(output_path, 'w') as f:
        f.write(content)

def convert_markdown_to_html(markdown_path):
    """Convert Markdown content to HTML."""
    with open(markdown_path, 'r') as f:
        markdown_content = f.read()
    return markdown2.markdown(markdown_content)

def generate_index():
    """Generate the index page."""
    print("Generating index page...")

    template = load_template('index.html')

    html_content = """
    This is my github page for the purpose of displaying projects and dashboard create using some static page tools. 
    Created using tools like FreeboardJs, ChartJS and D3JS. The data display by the dashboard was either using API data from public endpoint or pre-process data from my own data collectors node. 
    """

    project_list = [
        {'name': 'Live Wallet Monitoring', 'link': '/dashboards/crypto/monitor_balance_01.html', 'descr': 'Monitor live balances and latest transaction of an address. updated every 1 min.'},
        {'name': 'Stablecoins Dashboard', 'link': '/dashboards/crypto/stablecoin.html', 'descr': 'live metrics like total supply, total trade vol, onchain transfers for various stablecoins.'},
        {'name': 'Live Paxg Trading Metrics', 'link': '/dashboards/crypto/paxg.html', 'descr': 'PAXG trading metrics like volume, latest price, price-spreads, etc from various exchanges that trade PAXG.'},
        {'name': 'itBit Exchange Trading Metrics', 'link': '/dashboards/crypto/exchange_itbit.html', 'descr': 'ItBit Exchanges trading metrics from various intruments like BTCUSD, ETHUSD, PAXGUSD, etc..'},
        {'name': 'Live pricing (altcoin)', 'link': '/dashboards/crypto/price-dashboard-alt.html', 'descr': 'Live dashboard of pricing and volumes of altcoins from different exchanges.'},
        {'name': 'Live pricing (eth)', 'link': '/dashboards/crypto/price-dashboard-eth.html', 'descr': 'Live dashboard of pricing and volumes of eth from different exchanges.'},
        {'name': 'Live pricing itbit', 'link': '/dashboards/crypto/price-dashboard-itbit.html', 'descr': 'Live dashboard of pricing and volumes of coins in itbit exchanges.'}

    ]

    content = render_template(template, title="Welcome to inoTives Profile", content=html_content, proj_list=project_list)
    save_rendered_content(content, os.path.join(DOCS_DIR, 'index.html'))

def generate_portfolio():
    """Generate the portfolio page."""
    print("Generating portfolio page...")
    template = load_template('portfolio.html')
    projects = ["Project A", "Project B", "Project C"]  # Example projects list
    content = render_template(template, title="My Portfolio", projects=projects)
    save_rendered_content(content, os.path.join(DOCS_DIR, 'portfolio.html'))

def generate_blog_index():
    """Generate the blog index page."""
    print("Generating blog index page...")
    template = load_template('blog.html')
    posts = []

    for filename in os.listdir('posts'):
        if filename.endswith('.md'):
            title = filename.replace('.md', '')
            url = f"/blog/{filename.replace('.md', '.html')}"
            posts.append({'title': title, 'url': url})

    content = render_template(template, title="Blog", posts=posts)
    save_rendered_content(content, os.path.join(DOCS_DIR, 'blog.html'))

def generate_blog_posts():
    """Generate HTML files for each blog post."""
    print("Generating blog posts...")
    blog_dir = os.path.join(DOCS_DIR, 'blog')
    os.makedirs(blog_dir, exist_ok=True)
    template = load_template('post.html')

    for filename in os.listdir('posts'):
        if filename.endswith('.md'):
            post_title = filename.replace('.md', '')
            html_content = convert_markdown_to_html(os.path.join('posts', filename))
            content = render_template(template, title=post_title, content=html_content)
            post_output_path = os.path.join(blog_dir, filename.replace('.md', '.html'))
            save_rendered_content(content, post_output_path)

def generate_site():
    """Generate the entire static site."""
    generate_index()
    generate_portfolio()
    generate_blog_index()
    generate_blog_posts()
    print("Site generation complete.")

if __name__ == "__main__":
    generate_site()
