import { CommonModule } from '@angular/common';
import { Component, signal, OnInit, viewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initFlowbite } from 'flowbite';
import * as XLSX from 'xlsx';


@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pedidos-hospital');

  // Referencias a los elementos de input de archivos
  protected readonly catalogoInput = viewChild<ElementRef<HTMLInputElement>>('catalogoInput');
  protected readonly lineasInput = viewChild<ElementRef<HTMLInputElement>>('lineasInput');

  // Variables para almacenar los archivos seleccionados
  protected readonly catalogoFile = signal<File | null>(null);
  protected readonly lineasFiles = signal<File[]>([]);

  // Variables para almacenar los datos procesados de los archivos Excel
  protected readonly catalogoData = signal<any[]>([]);
  protected readonly lineasData = signal<any[]>([]);
  protected readonly catalogoColumns = signal<string[]>([]);
  protected readonly lineasColumns = signal<string[]>([]);
  protected readonly isProcessing = signal<boolean>(false);

  // Variables para el manejo de múltiples archivos de líneas
  protected readonly processedLineasFiles = signal<{file: File, data: any[], columns: string[], processed: boolean, error?: string}[]>([]);
  protected readonly lineasFilesValid = signal<boolean>(true);

  // Variables para la comparación de columnas
  protected readonly selectedCatalogoColumn = signal<string>('');
  protected readonly selectedLineasColumn = signal<string>('');
  protected readonly comparisonResults = signal<string[]>([]);
  protected readonly isComparing = signal<boolean>(false);

  ngOnInit(): void {
    console.log('App initialized');
    initFlowbite();
  }

  // Método para manejar la selección del archivo de catálogo
  protected onCatalogFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.catalogoFile.set(file);
    
    if (file) {
      console.log('Archivo de catálogo seleccionado:', file.name);
      this.processExcelFile(file, 'catalogo');
    }
  }

  // Método para manejar la selección de múltiples archivos de líneas de pedido
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

  // Método para procesar archivos Excel
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
        alert('Error al procesar el archivo. Asegúrate de que sea un archivo Excel válido.');
      } finally {
        this.isProcessing.set(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Método para procesar múltiples archivos de líneas de pedido
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
        alert('Algunos archivos tienen errores. Revisa el estado de cada archivo abajo.');
      } else {
        // Si todos los archivos son válidos, consolidar los datos
        this.lineasData.set(allProcessedData);
        this.lineasColumns.set(commonColumns);
        console.log(`Consolidación completada: ${allProcessedData.length} registros totales de ${files.length} archivos`);
      }

    } catch (error) {
      console.error('Error al procesar archivos múltiples:', error);
      alert('Error general al procesar los archivos.');
      this.lineasFilesValid.set(false);
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Método auxiliar para procesar un archivo de forma asíncrona
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

  // Método auxiliar para comparar arrays
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  // Método para comparar las columnas seleccionadas
  protected compareColumns(): void {
    const catalogoCol = this.selectedCatalogoColumn();
    const lineasCol = this.selectedLineasColumn();

    if (!catalogoCol || !lineasCol) {
      alert('Por favor, selecciona una columna de cada archivo.');
      return;
    }

    if (this.catalogoData().length === 0 || this.lineasData().length === 0) {
      alert('Por favor, carga ambos archivos antes de comparar.');
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
      const valoresFaltantes: string[] = [];
      
      this.catalogoData().forEach(row => {
        const valor = row[catalogoCol];
        if (valor !== null && valor !== undefined && valor !== '') {
          const valorNormalizado = String(valor).trim().toLowerCase();
          if (!lineasValues.has(valorNormalizado)) {
            const valorOriginal = String(valor).trim();
            if (!valoresFaltantes.includes(valorOriginal)) {
              valoresFaltantes.push(valorOriginal);
            }
          }
        }
      });

      this.comparisonResults.set(valoresFaltantes.sort());

      console.log(`Comparación completada:`);
      console.log(`- Valores únicos en catálogo (${catalogoCol}): ${catalogoValues.size}`);
      console.log(`- Valores únicos en pedidos (${lineasCol}): ${lineasValues.size}`);
      console.log(`- Valores del catálogo no encontrados en pedidos: ${valoresFaltantes.length}`);

    } catch (error) {
      console.error('Error al comparar columnas:', error);
      alert('Error al comparar las columnas. Verifica que las columnas seleccionadas contienen datos válidos.');
    } finally {
      this.isComparing.set(false);
    }
  }

  // Método para exportar resultados
  protected exportResults(): void {
    if (this.comparisonResults().length === 0) {
      alert('No hay resultados para exportar.');
      return;
    }

    const csvContent = [
      'Valores del catálogo no encontrados en pedidos',
      ...this.comparisonResults()
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

  // Método para limpiar la comparación
  protected clearComparison(): void {
    this.selectedCatalogoColumn.set('');
    this.selectedLineasColumn.set('');
    this.comparisonResults.set([]);
  }

  // Método para limpiar todos los archivos de líneas
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
