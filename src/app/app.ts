import { CommonModule } from '@angular/common';
import { Component, signal, OnInit, viewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initFlowbite } from 'flowbite';
import * as XLSX from 'xlsx';

/**
 * Componente principal de la aplicación Comparador de Pedidos y Catálogos.
 * 
 * Permite cargar archivos Excel de catálogo y líneas de pedido para compararlos
 * y encontrar valores del catálogo que no están presentes en los pedidos.
 * También genera archivos Excel limpios eliminando las filas problemáticas.
 * 
 * @description Aplicación web para el Hospital Infanta Margarita que facilita
 * la comparación entre catálogos de almacén y pedidos de servicios hospitalarios.
 * 
 * @author Hospital Infanta Margarita - Sistema de Gestión
 * @version 1.0.0
 */
@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  /** @description Título de la aplicación */
  protected readonly title = signal('pedidos-hospital');

  /** @description Referencia al elemento input del archivo de catálogo */
  protected readonly catalogoInput = viewChild<ElementRef<HTMLInputElement>>('catalogoInput');
  
  /** @description Referencia al elemento input de los archivos de líneas de pedido */
  protected readonly lineasInput = viewChild<ElementRef<HTMLInputElement>>('lineasInput');

  /** @description Signal que almacena el archivo de catálogo seleccionado */
  protected readonly catalogoFile = signal<File | null>(null);
  
  /** @description Signal que almacena la lista de archivos de líneas de pedido seleccionados */
  protected readonly lineasFiles = signal<File[]>([]);

  /** @description Signal que contiene los datos procesados del archivo de catálogo */
  protected readonly catalogoData = signal<any[]>([]);
  
  /** @description Signal que contiene los datos consolidados de todos los archivos de líneas de pedido */
  protected readonly lineasData = signal<any[]>([]);
  
  /** @description Signal que almacena los nombres de las columnas del catálogo */
  protected readonly catalogoColumns = signal<string[]>([]);
  
  /** @description Signal que almacena los nombres de las columnas de líneas de pedido */
  protected readonly lineasColumns = signal<string[]>([]);
  
  /** @description Signal que indica si se están procesando archivos Excel */
  protected readonly isProcessing = signal<boolean>(false);

  /** 
   * @description Signal que almacena información detallada sobre el procesamiento de cada archivo de líneas
   * @type {Signal<ProcessedFileInfo[]>} Array de información de archivos procesados
   */
  protected readonly processedLineasFiles = signal<{file: File, data: any[], columns: string[], processed: boolean, error?: string}[]>([]);
  
  /** @description Signal que indica si todos los archivos de líneas tienen una estructura válida */
  protected readonly lineasFilesValid = signal<boolean>(true);

  /** @description Signal que almacena la columna seleccionada del catálogo para comparación */
  protected readonly selectedCatalogoColumn = signal<string>('');
  
  /** @description Signal que almacena la columna seleccionada de líneas de pedido para comparación */
  protected readonly selectedLineasColumn = signal<string>('');
  
  /** @description Signal que contiene los valores del catálogo que no se encontraron en los pedidos */
  protected readonly comparisonResults = signal<{campo: string, nombre: string, displayText: string}[]>([]);
  
  /** @description Signal que indica si se está ejecutando una comparación de columnas */
  protected readonly isComparing = signal<boolean>(false);

  /**
   * Hook de inicialización del componente Angular.
   * 
   * @description Inicializa Flowbite para los componentes UI y muestra un toast de bienvenida.
   * @returns {void}
   */
  ngOnInit(): void {
    //console.log('App initialized');
    initFlowbite();
    
    // Mostrar toast de bienvenida después de un breve delay
    setTimeout(() => {
      this.showToast('info', '¡Bienvenido!', 'Comparador de pedidos y catálogos del Hospital Infanta Margarita', 4000);
    }, 1000);
  }

  /**
   * Muestra un toast de notificación usando Flowbite.
   * 
   * @description Crea y muestra un toast personalizable con diferentes tipos de notificación.
   * Los toasts se posicionan en la esquina superior derecha y se cierran automáticamente.
   * 
   * @param {('success'|'error'|'warning'|'info')} type - Tipo de notificación que determina el color y el icono
   * @param {string} title - Título principal del toast
   * @param {string} message - Mensaje descriptivo del toast
   * @param {number} [duration=5000] - Duración en milisegundos antes del auto-cierre
   * @returns {void}
   * 
   * @example
   * ```typescript
   * this.showToast('success', 'Operación exitosa', 'Los datos se han guardado correctamente', 3000);
   * this.showToast('error', 'Error de validación', 'Por favor revisa los campos requeridos');
   * ```
   */
  private showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 5000): void {
    const toastId = `toast-${Date.now()}`;
    const iconMap = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const colorMap = {
      success: 'text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200',
      error: 'text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200',
      warning: 'text-orange-500 bg-orange-100 dark:bg-orange-700 dark:text-orange-200',
      info: 'text-blue-500 bg-blue-100 dark:bg-gray-700 dark:text-blue-400'
    };

    const toastHTML = `
      <div id="${toastId}" class="flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800" role="alert">
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 ${colorMap[type]} rounded-lg">
          <span class="text-lg">${iconMap[type]}</span>
        </div>
        <div class="ms-3 text-sm font-normal">
          <div class="font-semibold">${title}</div>
          <div class="text-xs text-gray-600 dark:text-gray-300">${message}</div>
        </div>
        <button type="button" class="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" onclick="document.getElementById('${toastId}').remove()">
          <span class="sr-only">Cerrar</span>
          <svg class="w-3 h-3" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
          </svg>
        </button>
      </div>
    `;

    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      toastContainer.insertAdjacentHTML('beforeend', toastHTML);
      
      // Auto-cerrar después del tiempo especificado
      setTimeout(() => {
        const toastElement = document.getElementById(toastId);
        if (toastElement) {
          toastElement.style.opacity = '0';
          toastElement.style.transform = 'translateX(100%)';
          toastElement.style.transition = 'all 0.3s ease-in-out';
          setTimeout(() => toastElement.remove(), 300);
        }
      }, duration);
    }
  }

  /**
   * Maneja la selección del archivo de catálogo desde el input de archivos.
   * 
   * @description Procesa el archivo Excel de catálogo seleccionado por el usuario,
   * extrae sus datos y columnas para posterior comparación.
   * 
   * @param {Event} event - Evento de cambio del input de archivos
   * @returns {void}
   * 
   * @example
   * ```html
   * <input type="file" (change)="onCatalogFileSelected($event)" accept=".xlsx,.xls">
   * ```
   */
  protected onCatalogFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.catalogoFile.set(file);
    
    if (file) {
      console.log('Archivo de catálogo seleccionado:', file.name);
      this.processExcelFile(file, 'catalogo');
    }
  }

  /**
   * Maneja la selección de múltiples archivos de líneas de pedido.
   * 
   * @description Procesa varios archivos Excel de líneas de pedido, valida que tengan
   * la misma estructura de columnas y consolida todos los datos en un dataset unificado.
   * 
   * @param {Event} event - Evento de cambio del input de archivos múltiples
   * @returns {void}
   * 
   * @example
   * ```html
   * <input type="file" multiple (change)="onLineasFilesSelected($event)" accept=".xlsx,.xls">
   * ```
   */
  protected onLineasFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    if (files.length === 0) {
      this.lineasFiles.set([]);
      this.processedLineasFiles.set([]);
      this.lineasData.set([]);
      this.lineasColumns.set([]);
      return;
    }

    console.log(`${files.length} archivos de líneas de pedido seleccionados`);
    this.lineasFiles.set(files);
    
    // Inicializar el array de archivos procesados
    const initialProcessedFiles = files.map(file => ({
      file,
      data: [],
      columns: [],
      processed: false
    }));
    this.processedLineasFiles.set(initialProcessedFiles);
    
    // Procesar cada archivo
    this.processMultipleLineasFiles(files);
  }

  /**
   * Procesa un archivo Excel individual y extrae sus datos y columnas.
   * 
   * @description Utiliza SheetJS para leer archivos Excel (.xls/.xlsx), extrae la primera
   * hoja de cálculo, convierte los datos a JSON y almacena las columnas encontradas.
   * 
   * @param {File} file - Archivo Excel a procesar
   * @param {('catalogo'|'lineas')} type - Tipo de archivo para determinar dónde almacenar los datos
   * @returns {void}
   * 
   * @throws {Error} Si el archivo no es un Excel válido o está corrupto
   * 
   * @example
   * ```typescript
   * const file = new File([buffer], 'catalogo.xlsx');
   * this.processExcelFile(file, 'catalogo');
   * ```
   */
  private processExcelFile(file: File, type: 'catalogo' | 'lineas'): void {
    this.isProcessing.set(true);
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Obtener la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // La primera fila contiene los nombres de las columnas
        const columns = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        
        // Convertir las filas a objetos con las columnas como claves
        const processedData = rows.map((row: any[]) => {
          const obj: any = {};
          columns.forEach((col, index) => {
            obj[col] = row[index] || '';
          });
          return obj;
        });

        if (type === 'catalogo') {
          this.catalogoData.set(processedData);
          this.catalogoColumns.set(columns);
          console.log('Columnas del catálogo:', columns);
          console.log('Datos del catálogo:', processedData.slice(0, 5)); // Mostrar solo las primeras 5 filas
        } else {
          this.lineasData.set(processedData);
          this.lineasColumns.set(columns);
          console.log('Columnas de líneas de pedido:', columns);
          console.log('Datos de líneas de pedido:', processedData.slice(0, 5)); // Mostrar solo las primeras 5 filas
        }

      } catch (error) {
        console.error('Error al procesar el archivo Excel:', error);
        this.showToast('error', 'Error de archivo', 'Error al procesar el archivo. Asegúrate de que sea un archivo Excel válido.');
      } finally {
        this.isProcessing.set(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  /**
   * Procesa múltiples archivos de líneas de pedido de forma asíncrona.
   * 
   * @description Valida que todos los archivos tengan la misma estructura de columnas
   * y consolida sus datos en un dataset unificado. Maneja errores individuales sin
   * interrumpir el procesamiento de otros archivos.
   * 
   * @param {File[]} files - Array de archivos Excel a procesar
   * @returns {Promise<void>} Promesa que resuelve cuando todos los archivos están procesados
   * 
   * @validation
   * - Verifica que las columnas coincidan entre todos los archivos
   * - Valida que cada archivo sea un Excel legible
   * 
   * @features
   * - Procesamiento secuencial para evitar sobrecarga
   * - Consolidación automática de datos válidos
   * - Reporte detallado de errores por archivo
   * - Actualización en tiempo real del estado de cada archivo
   * 
   * @throws {Error} Si hay errores generales de procesamiento
   * 
   * @example
   * ```typescript
   * const files = [file1, file2, file3];
   * await this.processMultipleLineasFiles(files);
   * ```
   */
  private async processMultipleLineasFiles(files: File[]): Promise<void> {
    this.isProcessing.set(true);
    this.lineasFilesValid.set(true);
    
    try {
      const processedFiles = [...this.processedLineasFiles()];
      const allProcessedData: any[] = [];
      let commonColumns: string[] = [];
      let hasErrors = false;

      // Procesar cada archivo secuencialmente
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Procesando archivo ${i + 1}/${files.length}: ${file.name}`);
        
        try {
          const fileData = await this.processLineasFileAsync(file);
          processedFiles[i] = {
            ...processedFiles[i],
            data: fileData.data,
            columns: fileData.columns,
            processed: true
          };

          // Validar columnas (todos los archivos deben tener las mismas columnas)
          if (i === 0) {
            commonColumns = [...fileData.columns];
          } else {
            if (!this.arraysEqual(commonColumns, fileData.columns)) {
              const error = `Las columnas no coinciden con el primer archivo. Esperadas: [${commonColumns.join(', ')}], Encontradas: [${fileData.columns.join(', ')}]`;
              processedFiles[i] = {
                ...processedFiles[i],
                processed: true,
                error
              };
              hasErrors = true;
              console.error(`Error en ${file.name}:`, error);
              continue;
            }
          }

          // Agregar datos al conjunto consolidado
          allProcessedData.push(...fileData.data);

        } catch (error) {
          const errorMsg = `Error al procesar el archivo: ${error}`;
          processedFiles[i] = {
            ...processedFiles[i],
            processed: true,
            error: errorMsg
          };
          hasErrors = true;
          console.error(`Error en ${file.name}:`, errorMsg);
        }
      }

      // Actualizar el estado
      this.processedLineasFiles.set(processedFiles);
      
      if (hasErrors) {
        this.lineasFilesValid.set(false);
        this.showToast('warning', 'Archivos con errores', 'Algunos archivos tienen errores. Revisa el estado de cada archivo abajo.');
      } else {
        // Si todos los archivos son válidos, consolidar los datos
        this.lineasData.set(allProcessedData);
        this.lineasColumns.set(commonColumns);
        console.log(`Consolidación completada: ${allProcessedData.length} registros totales de ${files.length} archivos`);
        this.showToast('success', 'Archivos consolidados', `${files.length} archivos procesados con ${allProcessedData.length} registros totales`, 6000);
      }

    } catch (error) {
      console.error('Error al procesar archivos múltiples:', error);
      this.showToast('error', 'Error de procesamiento', 'Error general al procesar los archivos.');
      this.lineasFilesValid.set(false);
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Procesa un archivo de líneas de pedido de forma asíncrona.
   * 
   * @description Método auxiliar que lee un archivo Excel usando FileReader y SheetJS,
   * extrae los datos y columnas, y devuelve una promesa con el resultado.
   * 
   * @param {File} file - Archivo Excel de líneas de pedido a procesar
   * @returns {Promise<{data: any[], columns: string[]}>} Promesa con datos y columnas extraídos
   * 
   * @throws {Error} Si el archivo no puede leerse o no es un Excel válido
   * 
   * @example
   * ```typescript
   * const result = await this.processLineasFileAsync(file);
   * console.log(`Procesado: ${result.columns.length} columnas, ${result.data.length} filas`);
   * ```
   */
  private processLineasFileAsync(file: File): Promise<{data: any[], columns: string[]}> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          const columns = jsonData[0] as string[];
          const rows = jsonData.slice(1);
          
          const processedData = rows.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col, index) => {
              obj[col] = row[index] || '';
            });
            return obj;
          });

          resolve({
            data: processedData,
            columns: columns
          });

        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Compara si dos arrays de strings son idénticos.
   * 
   * @description Método auxiliar que verifica si dos arrays tienen la misma longitud
   * y los mismos elementos en el mismo orden. Utilizado para validar estructuras de columnas.
   * 
   * @param {string[]} arr1 - Primer array a comparar
   * @param {string[]} arr2 - Segundo array a comparar
   * @returns {boolean} true si los arrays son idénticos, false en caso contrario
   * 
   * @example
   * ```typescript
   * const cols1 = ['Código', 'Descripción', 'Precio'];
   * const cols2 = ['Código', 'Descripción', 'Precio'];
   * const areEqual = this.arraysEqual(cols1, cols2); // true
   * ```
   */
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  /**
   * Compara las columnas seleccionadas entre catálogo y líneas de pedido.
   * 
   * @description Identifica valores presentes en la columna del catálogo que no se
   * encuentran en la columna de líneas de pedido. Captura tanto el campo seleccionado
   * como el campo "nombre" para mostrar información más completa. Realiza normalización
   * de datos para comparaciones precisas (ignora mayúsculas/minúsculas y espacios).
   * 
   * @returns {void}
   * 
   * @validation
   * - Verifica que se hayan seleccionado ambas columnas
   * - Confirma que ambos archivos tengan datos cargados
   * 
   * @features
   * - Busca automáticamente el campo "nombre" en diferentes variaciones
   * - Genera texto de visualización en formato "{campo} - {nombre}"
   * - Elimina duplicados basándose en el campo principal
   * - Ordena alfabéticamente los resultados
   * 
   * @example
   * ```typescript
   * // Después de cargar archivos y seleccionar columnas
   * this.compareColumns(); // Encuentra valores del catálogo no presentes en pedidos
   * // Resultado: [{campo: "A1234", nombre: "Paracetamol", displayText: "A1234 - Paracetamol"}]
   * ```
   */
  protected compareColumns(): void {
    const catalogoCol = this.selectedCatalogoColumn();
    const lineasCol = this.selectedLineasColumn();

    if (!catalogoCol || !lineasCol) {
      this.showToast('warning', 'Selección incompleta', 'Por favor, selecciona una columna de cada archivo.');
      return;
    }

    if (this.catalogoData().length === 0 || this.lineasData().length === 0) {
      this.showToast('error', 'Archivos faltantes', 'Por favor, carga ambos archivos antes de comparar.');
      return;
    }

    this.isComparing.set(true);

    try {
      // Obtener todos los valores únicos de la columna de catálogo
      const catalogoValues = new Set(
        this.catalogoData()
          .map(row => row[catalogoCol])
          .filter(value => value !== null && value !== undefined && value !== '')
          .map(value => String(value).trim().toLowerCase())
      );

      // Obtener todos los valores únicos de la columna de líneas de pedido
      const lineasValues = new Set(
        this.lineasData()
          .map(row => row[lineasCol])
          .filter(value => value !== null && value !== undefined && value !== '')
          .map(value => String(value).trim().toLowerCase())
      );

      // Encontrar valores del catálogo que NO están en líneas de pedido
      const valoresFaltantes: {campo: string, nombre: string, displayText: string}[] = [];
      const valoresYaProcesados = new Set<string>();
      
      this.catalogoData().forEach(row => {
        const valor = row[catalogoCol];
        if (valor !== null && valor !== undefined && valor !== '') {
          const valorNormalizado = String(valor).trim().toLowerCase();
          if (!lineasValues.has(valorNormalizado) && !valoresYaProcesados.has(valorNormalizado)) {
            const valorOriginal = String(valor).trim();
            const nombre = row['nombre'] || row['Nombre'] || row['NOMBRE'] || row['descripcion'] || row['Descripcion'] || row['DESCRIPCION'] || 'Sin nombre';
            const displayText = `${valorOriginal} - ${nombre}`;
            
            valoresFaltantes.push({
              campo: valorOriginal,
              nombre: String(nombre).trim(),
              displayText: displayText
            });
            
            valoresYaProcesados.add(valorNormalizado);
          }
        }
      });

      // Ordenar por campo
      const valoresOrdenados = valoresFaltantes.sort((a, b) => a.campo.localeCompare(b.campo));
      this.comparisonResults.set(valoresOrdenados);

      console.log(`Comparación completada:`);
      console.log(`- Valores únicos en catálogo (${catalogoCol}): ${catalogoValues.size}`);
      console.log(`- Valores únicos en pedidos (${lineasCol}): ${lineasValues.size}`);
      console.log(`- Valores del catálogo no encontrados en pedidos: ${valoresOrdenados.length}`);
      console.log('- Valores faltantes:', valoresOrdenados.map(item => item.displayText));

    } catch (error) {
      console.error('Error al comparar columnas:', error);
      this.showToast('error', 'Error en la comparación', 'Error al comparar las columnas. Verifica que las columnas seleccionadas contienen datos válidos.');
    } finally {
      this.isComparing.set(false);
    }
  }

  /**
   * Exporta los resultados de la comparación a un archivo CSV.
   * 
   * @description Genera y descarga un archivo CSV que contiene la lista de valores
   * del catálogo que no fueron encontrados en las líneas de pedido.
   * 
   * @returns {void}
   * 
   * @validation Verifica que existan resultados de comparación antes de exportar
   * 
   * @example
   * ```typescript
   * // Después de ejecutar compareColumns() con resultados
   * this.exportResults(); // Descarga 'valores_faltantes.csv'
   * ```
   */
  protected exportResults(): void {
    if (this.comparisonResults().length === 0) {
      this.showToast('info', 'Sin resultados', 'No hay resultados para exportar.');
      return;
    }

    const csvContent = [
      'Campo,Nombre,Descripción Completa',
      ...this.comparisonResults().map(item => `"${item.campo}","${item.nombre}","${item.displayText}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'valores_faltantes.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Genera y descarga un archivo Excel del catálogo sin las filas problemáticas.
   * 
   * @description Crea un nuevo archivo Excel eliminando las filas que contienen
   * valores no encontrados en los pedidos. Mantiene el formato original del archivo.
   * 
   * @returns {void}
   * 
   * @validation 
   * - Verifica que existan valores para eliminar
   * - Confirma que haya datos del catálogo y columna seleccionada
   * 
   * @features
   * - Preserva el formato del archivo original (.xls o .xlsx)
   * - Normaliza valores para comparación precisa
   * - Mantiene filas con valores vacíos
   * - Proporciona estadísticas de limpieza
   * 
   * @example
   * ```typescript
   * // Después de comparar y encontrar valores faltantes
   * this.exportCleanCatalog(); // Descarga 'catalogo_limpio.xlsx'
   * ```
   */
  protected exportCleanCatalog(): void {
    if (this.comparisonResults().length === 0) {
      this.showToast('info', 'Catálogo completo', 'No hay valores para limpiar. El catálogo ya está completo.');
      return;
    }

    if (this.catalogoData().length === 0 || !this.selectedCatalogoColumn()) {
      this.showToast('error', 'Datos insuficientes', 'No hay datos del catálogo o no se ha seleccionado una columna para comparar.');
      return;
    }

    try {
      // Obtener los valores que deben eliminarse (normalizar para comparación)
      const valoresAEliminar = new Set(
        this.comparisonResults().map(item => item.campo.trim().toLowerCase())
      );

      // Filtrar los datos del catálogo eliminando las filas que contienen valores no encontrados
      const catalogoLimpio = this.catalogoData().filter(row => {
        const valorColumna = row[this.selectedCatalogoColumn()];
        if (valorColumna === null || valorColumna === undefined || valorColumna === '') {
          return true; // Mantener filas con valores vacíos
        }
        
        const valorNormalizado = String(valorColumna).trim().toLowerCase();
        return !valoresAEliminar.has(valorNormalizado);
      });

      // Crear un nuevo workbook
      const wb = XLSX.utils.book_new();
      
      // Convertir los datos limpios a hoja de cálculo
      const ws = XLSX.utils.json_to_sheet(catalogoLimpio);
      
      // Agregar la hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Limpio');

      // Determinar la extensión del archivo original
      const originalFileName = this.catalogoFile()?.name || 'catalogo.xlsx';
      const fileExtension = originalFileName.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx';
      const cleanFileName = `catalogo_limpio${fileExtension}`;

      // Generar y descargar el archivo
      XLSX.writeFile(wb, cleanFileName);

      console.log(`Catálogo limpio generado:`);
      console.log(`- Registros originales: ${this.catalogoData().length}`);
      console.log(`- Registros eliminados: ${this.catalogoData().length - catalogoLimpio.length}`);
      console.log(`- Registros en catálogo limpio: ${catalogoLimpio.length}`);
      console.log(`- Archivo generado: ${cleanFileName}`);

      this.showToast('success', 'Catálogo limpio generado', `Registros originales: ${this.catalogoData().length} | Eliminados: ${this.catalogoData().length - catalogoLimpio.length} | Restantes: ${catalogoLimpio.length}`, 8000);

    } catch (error) {
      console.error('Error al generar el catálogo limpio:', error);
      this.showToast('error', 'Error al generar archivo', 'Error al generar el catálogo limpio. Verifica que los datos sean válidos.');
    }
  }

  /**
   * Limpia los datos de comparación y resetea las selecciones.
   * 
   * @description Reinicia las columnas seleccionadas y los resultados de comparación,
   * permitiendo al usuario realizar una nueva comparación desde cero.
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * this.clearComparison(); // Resetea la comparación actual
   * ```
   */
  protected clearComparison(): void {
    this.selectedCatalogoColumn.set('');
    this.selectedLineasColumn.set('');
    this.comparisonResults.set([]);
  }

  /**
   * Limpia todos los archivos de líneas de pedido y resetea el estado.
   * 
   * @description Elimina todos los archivos de líneas cargados, sus datos procesados,
   * y resetea el input de archivos y las comparaciones relacionadas.
   * 
   * @returns {void}
   * 
   * @sideEffects
   * - Limpia el valor del input HTML
   * - Resetea todas las validaciones de archivos
   * - Ejecuta clearComparison() automáticamente
   * 
   * @example
   * ```typescript
   * this.clearLineasFiles(); // Elimina todos los archivos de líneas de pedido
   * ```
   */
  protected clearLineasFiles(): void {
    this.lineasFiles.set([]);
    this.processedLineasFiles.set([]);
    this.lineasData.set([]);
    this.lineasColumns.set([]);
    this.lineasFilesValid.set(true);
    this.clearComparison();
    
    // Limpiar el input también
    const lineasInput = document.getElementById('file_input_lineas') as HTMLInputElement;
    if (lineasInput) {
      lineasInput.value = '';
    }
  }
}
