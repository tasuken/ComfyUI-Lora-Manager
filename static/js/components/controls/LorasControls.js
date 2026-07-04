// LorasControls.js - Specific implementation for the LoRAs page
import { PageControls } from './PageControls.js';
import { getModelApiClient, resetAndReload } from '../../api/modelApiFactory.js';
import { MODEL_TYPES } from '../../api/apiConfig.js';
import { getSessionItem, removeSessionItem, setSessionItem } from '../../utils/storageHelpers.js';
import { createAlphabetBar } from '../alphabet/index.js';
import { downloadManager } from '../../managers/DownloadManager.js';

/**
 * LorasControls class - Extends PageControls for LoRA-specific functionality
 */
export class LorasControls extends PageControls {
    constructor() {
        // Initialize with 'loras' page type
        super('loras');
        
        // Register API methods specific to the LoRAs page
        this.registerLorasAPI();
        
        // Check for custom filters (e.g., from recipe navigation)
        this.checkCustomFilters();
        
        // Initialize alphabet bar component
        this.initAlphabetBar();
    }
    
    /**
     * Register LoRA-specific API methods
     */
    registerLorasAPI() {
        const lorasAPI = {
            // Core API functions
            loadMoreModels: async (resetPage = false, updateFolders = false) => {
                return await getModelApiClient().loadMoreWithVirtualScroll(resetPage, updateFolders);
            },
            
            resetAndReload: async (updateFolders = false) => {
                return await resetAndReload(updateFolders);
            },
            
            refreshModels: async (fullRebuild = false) => {
                return await getModelApiClient().refreshModels(fullRebuild);
            },
            
            // LoRA-specific API functions
            fetchFromCivitai: async () => {
                return await getModelApiClient().fetchCivitaiMetadata();
            },
            
            showDownloadModal: () => {
                downloadManager.showDownloadModal();
            },
            
            toggleBulkMode: () => {
                if (window.bulkManager) {
                    window.bulkManager.toggleBulkMode();
                } else {
                    console.error('Bulk manager not available');
                }
            },
            
            clearCustomFilter: async () => {
                await this.clearCustomFilter();
            }
        };
        
        // Register the API
        this.registerAPI(lorasAPI);
    }
    
    /**
     * Check for custom filter parameters in session storage (e.g., from recipe page navigation)
     */
    checkCustomFilters() {
        const params = new URLSearchParams(window.location.search);
        const urlLoraHash = params.get('lora_hash');
        if (urlLoraHash) {
            setSessionItem('recipe_to_lora_filterLoraHash', urlLoraHash.toLowerCase());
            if (params.get('view') === 'detail') {
                setSessionItem('viewLoraDetail', 'true');
            }
            const fromRecipe = params.get('from_recipe');
            if (fromRecipe) {
                setSessionItem('filterRecipeName', fromRecipe);
            } else if (!getSessionItem('filterRecipeName')) {
                setSessionItem('filterRecipeName', 'External link');
            }
        }

        const filterLoraHash = getSessionItem('recipe_to_lora_filterLoraHash');
        const filterLoraHashes = getSessionItem('recipe_to_lora_filterLoraHashes');
        const filterRecipeName = getSessionItem('filterRecipeName');
        const viewLoraDetail = getSessionItem('viewLoraDetail');
        
        if ((filterLoraHash || filterLoraHashes) && filterRecipeName) {
            // Found custom filter parameters, set up the custom filter
            
            // Show the filter indicator
            const indicator = document.getElementById('customFilterIndicator');
            const filterText = indicator?.querySelector('.customFilterText');
            
            if (indicator && filterText) {
                indicator.classList.remove('hidden');
                
                // Set text content with recipe name
                const filterType = filterLoraHash && viewLoraDetail ? "Viewing LoRA from" : "Viewing LoRAs from";
                const displayText = `${filterType}: ${filterRecipeName}`;
                
                filterText.textContent = this._truncateText(displayText, 30);
                filterText.setAttribute('title', displayText);
                
                // Add pulse animation
                const filterElement = indicator.querySelector('.filter-active');
                if (filterElement) {
                    filterElement.classList.add('animate');
                    setTimeout(() => filterElement.classList.remove('animate'), 600);
                }
            }
            
            // If we're viewing a specific LoRA detail, set up to open the modal
            if (filterLoraHash && viewLoraDetail) {
                this.pageState.pendingLoraHash = filterLoraHash;
            }
        }
    }

    /**
     * Open the LoRA detail modal when navigated with view=detail (mirrors recipes _openRecipeFromFilter).
     */
    async openPendingLoraDetail() {
        const loraHash = this.pageState.pendingLoraHash;
        if (!loraHash) {
            return;
        }

        delete this.pageState.pendingLoraHash;
        removeSessionItem('viewLoraDetail');

        const normalizedHash = loraHash.toLowerCase();

        try {
            const result = await getModelApiClient().fetchModelsPage(1, this.pageState.pageSize || 100);
            const model = result.items.find(
                (item) => item.sha256?.toLowerCase() === normalizedHash
            );

            if (!model) {
                console.warn('Failed to open LoRA from filter: model not found for hash', loraHash);
                return;
            }

            const { showModelModal } = await import('../shared/ModelModal.js');
            await showModelModal(model, MODEL_TYPES.LORA);
        } catch (error) {
            console.warn('Failed to open LoRA from filter:', error);
        }
    }
    
    /**
     * Clear the custom filter and reload the page
     */
    async clearCustomFilter() {
        // Check for View Local Versions filter first (handles VLM and reloads)
        const vlmModelId = getSessionItem('vlm_model_id');
        if (vlmModelId) {
            removeSessionItem('vlm_model_id');
            removeSessionItem('vlm_model_name');
            removeSessionItem('vlm_base_model');
            removeSessionItem('vlm_page_type');
            this._restoreSortAfterVlm();
            const indicator = document.getElementById('customFilterIndicator');
            if (indicator) {
                indicator.classList.add('hidden');
            }
            await resetAndReload();
            return;
        }

        console.log("Clearing custom filter...");
        // Remove filter parameters from session storage
        removeSessionItem('recipe_to_lora_filterLoraHash');
        removeSessionItem('recipe_to_lora_filterLoraHashes');
        removeSessionItem('filterRecipeName');
        removeSessionItem('viewLoraDetail');
        
        // Hide the filter indicator
        const indicator = document.getElementById('customFilterIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
        
        // Reset state
        if (this.pageState.pendingLoraHash) {
            delete this.pageState.pendingLoraHash;
        }
        
        // Reload the loras
        await resetAndReload();
    }
    
    /**
     * Initialize the alphabet bar component
     */
    initAlphabetBar() {
        // Create the alphabet bar component
        this.alphabetBar = createAlphabetBar('loras');
        
        // Expose the alphabet bar to the global scope for debugging
        window.alphabetBar = this.alphabetBar;
    }
}