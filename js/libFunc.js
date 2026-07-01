export class libFunc {

	static saveShadowToFile(originalImage, fileName) {
	    const hiddenCanvas = document.createElement('canvas');
	    const hiddenCtx = hiddenCanvas.getContext('2d');
	    hiddenCanvas.width = originalImage.width;
	    hiddenCanvas.height = originalImage.height;

	    hiddenCtx.filter = 'brightness(0) opacity(0.5)';
	    hiddenCtx.drawImage(originalImage, 0, 0);

	    // 2. Превращаем Canvas в строку данных (Base64 URL)
	    const dataUrl = hiddenCanvas.toDataURL('image/png');

	    // 3. Создаем виртуальную ссылку для скачивания
	    const downloadLink = document.createElement('a');
	    downloadLink.href = dataUrl;
	    
	    // Задаем имя файла (например, "tree_shadow.png")
	    downloadLink.download = fileName.replace('.png', '_shadow.png');

	    // Immitруем клик мыши для скачивания файла
	    document.body.appendChild(downloadLink);
	    downloadLink.click();
	    document.body.removeChild(downloadLink); // Удаляем ссылку
	}

	static async convertPngToWebpAndDownload(pngInput, customFileName) {
	    try {
	        let imgElementToDraw = null;
	        let originalSrc = "converted_image";

	        // =========================================================================
	        // УМНАЯ ПРОВЕРКА ВХОДНЫХ ДАННЫХ:
	        // =========================================================================
	        if (pngInput instanceof HTMLImageElement) {
	            // ЕСЛИ ПРИШЛА КАРТИНКА: Нам не нужен fetch! Сразу берем этот готовый элемент
	            imgElementToDraw = pngInput;
	            originalSrc = pngInput.src || "image_from_element";
	            console.log(`[Converter]: Вход распознан как HTMLImageElement. Извлекаем данные...`);
	        } 
	        else if (typeof pngInput === 'string') {
	            // ЕСЛИ ПРИШЛА СТРОКА-ПУТЬ: Загружаем файл через fetch, как и раньше
	            console.log(`[Converter]: Загрузка исходного файла по пути: ${pngInput}`);
	            originalSrc = pngInput;

	            const response = await fetch(pngInput);
	            if (!response.ok) throw new Error(`Не удалось загрузить файл по пути: ${pngInput}`);
	            const pngBlob = await response.blob();

	            const img = new Image();
	            const objectURL = URL.createObjectURL(pngBlob);
	            
	            await new Promise((resolve, reject) => {
	                img.onload = resolve;
	                img.onerror = reject;
	                img.src = objectURL;
	            });

	            imgElementToDraw = img;
	            URL.revokeObjectURL(objectURL); // Чистим память от временного URL
	        } 
	        else {
	            throw new Error(`Неподдерживаемый тип данных на входе. Ожидалась строка или HTMLImageElement, пришло: ${typeof pngInput}`);
	        }
	        // =========================================================================

	        if (!imgElementToDraw || imgElementToDraw.width === 0) {
	            throw new Error("Изображение не загружено или имеет нулевой размер");
	        }

	        // Создаем скрытый Canvas под размеры картинки
	        const canvas = document.createElement('canvas');
	        canvas.width = imgElementToDraw.width;
	        canvas.height = imgElementToDraw.height;
	        
	        const ctx = canvas.getContext('2d');
	        if (!ctx) throw new Error("Не удалось получить контекст Canvas 2D");

	        // Очищаем и рисуем
	        ctx.clearRect(0, 0, canvas.width, canvas.height);
	        ctx.drawImage(imgElementToDraw, 0, 0);

	        // Конвертируем в WebP Blob с сохранением альфа-канала прозрачности
	        canvas.toBlob((webpBlob) => {
	            if (!webpBlob) {
	                console.error("[Converter]: Ошибка конвертации в WebP Blob");
	                return;
	            }

	            // Генерируем имя файла из исходного пути или берем кастомное
	            let fileName = customFileName;
	            if (!fileName) {
	                const baseName = originalSrc.split('?')[0].split('/').pop() || 'converted_image';
	                fileName = baseName.replace(/\.[^/.]+$/, "");
	            }

	            // Запускаем автоматическое скачивание браузером
	            const downloadLink = document.createElement('a');
	            downloadLink.href = URL.createObjectURL(webpBlob);
	            downloadLink.download = `${fileName}.webp`;
	            
	            document.body.appendChild(downloadLink);
	            downloadLink.click();
	            
	            document.body.removeChild(downloadLink);
	            URL.revokeObjectURL(downloadLink.href);

	            console.log(`[Converter]: Файл '${fileName}.webp' успешно скачан.`);
	        }, 'image/webp', 1.0);

	    } catch (error) {
	        console.error(`[Converter]: Катастрофическая ошибка при конвертации в WebP:`, error);
	    }
	}

}