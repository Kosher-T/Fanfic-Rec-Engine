document.addEventListener('DOMContentLoaded', () => {

    const urlInput = document.getElementById('ffn-url-input');
    const getRecsButton = document.getElementById('get-recs-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const recommendationsContainer = document.getElementById('recommendations-container');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const searchIcon = document.getElementById('search-icon');
    const buttonText = document.getElementById('button-text');

    getRecsButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();

        // --- Input Validation for AO3 ---
        if (!url || !url.includes('archiveofourown.org/works/')) {
            showError('Please enter a valid Archive of Our Own (AO3) story URL.');
            return;
        }

        setLoadingState(true);
        hideError();
        recommendationsContainer.innerHTML = '';

        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ story_url: url }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const message = errorData ? errorData.error : `Server returned an error: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();

            if (data.recommendations && data.recommendations.length > 0) {
                displayRecommendations(data.recommendations);
            } else {
                showError("Could not find any recommendations for this story.");
            }

        } catch (error) {
            console.error('Error fetching recommendations:', error);
            showError(error.message);
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingSpinner.classList.remove('hidden');
            getRecsButton.disabled = true;
            getRecsButton.classList.add('opacity-50', 'cursor-not-allowed');
            searchIcon.classList.add('hidden');
            buttonText.textContent = 'Searching...';
        } else {
            loadingSpinner.classList.add('hidden');
            getRecsButton.disabled = false;
            getRecsButton.classList.remove('opacity-50', 'cursor-not-allowed');
            searchIcon.classList.remove('hidden');
            buttonText.textContent = 'Get Recommendations';
        }
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    function displayRecommendations(recommendations) {
        recommendationsContainer.innerHTML = '';

        recommendations.forEach(story => {
            // Updated card for AO3 stats (Kudos instead of Favs)
            const storyCard = `
                <div class="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col animate-fade-in">
                    <h3 class="text-xl font-bold text-white mb-2">${story.title}</h3>
                    <p class="text-sm text-gray-400 mb-2">by ${story.author}</p>
                    <p class="text-gray-300 flex-grow mb-4">${story.summary}</p>
                    <div class="text-sm text-green-400 mb-4">
                        <span><b>Reason:</b> ${story.reason}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-gray-400 mb-4">
                        <span><b>Words:</b> ${story.words.toLocaleString()}</span>
                        <span><b>Kudos:</b> ${story.favs.toLocaleString()}</span>
                        <span class="font-semibold ${story.status === 'Complete' ? 'text-green-400' : 'text-yellow-400'}">${story.status}</span>
                    </div>
                    <a href="${story.url}" target="_blank" rel="noopener noreferrer" class="mt-auto bg-gray-700 hover:bg-gray-600 text-white text-center font-bold py-2 px-4 rounded-md transition duration-200">
                        Read on AO3
                    </a>
                </div>
            `;
            recommendationsContainer.innerHTML += storyCard;
        });
    }

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
});
