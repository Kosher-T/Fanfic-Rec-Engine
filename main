import re
import urllib.parse
from flask import Flask, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup

# --- 1. FLASK APP INITIALIZATION ---
app = Flask(__name__, static_folder='static', template_folder='templates')

# --- 2. HELPER FUNCTION ---
def get_soup(url):
    """Fetches a URL and returns a BeautifulSoup object."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Network error fetching URL: {url}. Details: {e}")


# --- 3. CORE SCRAPING LOGIC (NEWEST, MOST RELIABLE VERSION) ---
def scrape_story_for_search_term(url):
    """
    Scrapes an AO3 story page for the best possible search term. This version
    validates the page by finding the title first, then searches for tags.
    """
    print(f"--- Starting scrape for initial story: {url} ---")
    try:
        # Normalize URL to ensure we are on the main work page
        work_url = re.sub(r'/chapters/.*', '', url)
        if work_url != url:
            print(f"Normalized URL to: {work_url}")

        soup = get_soup(work_url)

        # --- Stage 1: Perform initial checks for non-story pages ---
        if soup.find('div', class_='flash-error'):
            raise ValueError(f"This work may be restricted or private. AO3 says: '{soup.find('div', class_='flash-error').text.strip()}'")
        if soup.find('div', id='series-show'):
            raise ValueError("This appears to be a series page, not an individual story. Please provide a link to a specific work.")

        # --- Stage 2: Validate the page by finding the title FIRST. This is the most reliable check. ---
        title_element = soup.select_one('h2.title')
        if not title_element:
             raise ValueError("The provided URL does not appear to be a valid story page (could not find a title).")
        story_title = title_element.text.strip()
        print(f"Found story title: '{story_title}'. Now searching for tags...")

        # --- Stage 3: Now that we know it's a story, look for tags ---
        work_meta = soup.find('div', id='workmeta')
        if work_meta:
            tag_preference = [
                {'type': 'relationship', 'selector': 'dd.relationship a'},
                {'type': 'freeform', 'selector': 'dd.freeform a'},
                {'type': 'character', 'selector': 'dd.character a'}
            ]
            for pref in tag_preference:
                tag_link = work_meta.select_one(pref['selector'])
                if tag_link:
                    search_tag = tag_link.text.strip()
                    print(f"SUCCESS: Found tag '{search_tag}' of type '{pref['type']}'.")
                    return {
                        'search_term': search_tag,
                        'search_type': pref['type'],
                        'original_url': work_url
                    }

        # --- Stage 4: FALLBACK - If no tags were found, use the title we already have ---
        print("WARNING: Could not find any suitable tags. Falling back to title search.")
        return {
            'search_term': story_title,
            'search_type': 'title',
            'original_url': work_url
        }

    except ValueError as ve:
        raise ve # Re-raise our custom errors
    except Exception as e:
        print(f"An unexpected error occurred in scrape_story_for_search_term: {e}")
        raise ValueError(f"An unknown error occurred while scraping the story: {e}")


def scrape_ao3_search_results(search_term, search_type, original_url_to_exclude):
    """
    Searches AO3 for a given term (tag or title) and scrapes the top results.
    """
    print(f"--- Searching for recommendations with {search_type}: '{search_term}' ---")
    try:
        encoded_term = urllib.parse.quote_plus(search_term)

        search_field_map = {
            'relationship': 'relationship_names',
            'freeform': 'other_tag_names',
            'character': 'character_names',
            'title': 'title' 
        }
        search_field = search_field_map.get(search_type, 'other_tag_names')

        search_url = f"https://archiveofourown.org/works/search?work_search%5Bsort_column%5D=kudos_count&work_search%5B{search_field}%5D={encoded_term}&commit=Search"
        print(f"Constructed search URL: {search_url}")

        soup = get_soup(search_url)

        recommendations = []
        story_listings = soup.select('li[role="article"]')

        for story in story_listings:
            if len(recommendations) >= 4:
                break

            link_element = story.find('h4', class_='heading').find('a')
            story_url = "https://archiveofourown.org" + link_element['href']

            normalized_story_url = re.sub(r'/chapters/.*', '', story_url)
            if normalized_story_url == original_url_to_exclude:
                print(f"Skipping original story: {story_url}")
                continue

            title = link_element.text.strip()
            author = (story.find('a', rel='author') or story.find('span', class_='author')).text.strip()
            summary = (story.find('blockquote', class_='userstuff summary') or BeautifulSoup('<p>No summary provided.</p>', 'html.parser')).text.strip()
            kudos = (story.find('dd', class_='kudos') or BeautifulSoup('<dd>0</dd>', 'html.parser')).text.strip().replace(',', '')
            words = (story.find('dd', class_='words') or BeautifulSoup('<dd>0</dd>', 'html.parser')).text.strip().replace(',', '')
            chapters = (story.find('dd', class_='chapters') or BeautifulSoup('<dd>1/1</dd>', 'html.parser')).text.strip()
            status = 'Complete' if '?' not in chapters and chapters.split('/')[0] == chapters.split('/')[1] else 'In-Progress'
            reason_text = "Similar Title" if search_type == 'title' else "Similar Tag"

            recommendations.append({
                'title': title, 'author': author, 'summary': summary,
                'reason': f"{reason_text}: '{search_term}'",
                'words': int(words) if words else 0, 
                'favs': int(kudos) if kudos else 0, 
                'status': status, 'url': story_url
            })

        print(f"SUCCESS: Found {len(recommendations)} recommendations.")
        return recommendations

    except Exception as e:
        print(f"An unexpected error occurred during search scraping: {e}")
        return []


# --- 4. FLASK ROUTES ---
@app.route('/api/recommend', methods=['POST'])
def recommend_api():
    try:
        data = request.get_json()
        if not data or 'story_url' not in data:
            return jsonify({'error': 'Missing story_url in request'}), 400

        story_url = data['story_url']

        story_info = scrape_story_for_search_term(story_url)

        recommendations = scrape_ao3_search_results(
            story_info['search_term'],
            story_info['search_type'],
            story_info['original_url']
        )

        if not recommendations:
            return jsonify({'error': 'Found a search term, but the search returned no similar public works.'}), 404

        return jsonify({'recommendations': recommendations})

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500

@app.route('/')
def home():
    return render_template('index.html')

# --- 5. RUN THE APP ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
