import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Parse Excel file
async function parseExcelFile(buffer: Buffer): Promise<any[]> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return data;
  } catch (error) {
    throw new Error('Failed to parse Excel file');
  }
}

// Parse CSV file
async function parseCSVFile(buffer: Buffer): Promise<any[]> {
  try {
    const text = buffer.toString('utf8');
    const result = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: true
    });
    return result.data;
  } catch (error) {
    throw new Error('Failed to parse CSV file');
  }
}

// Save file data to temporary storage
function saveFileData(userId: string, fileName: string, data: any[]): string {
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  
  const fileId = `${userId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = join(uploadsDir, `${fileId}.json`);
  
  writeFileSync(filePath, JSON.stringify({
    fileName,
    uploadDate: new Date().toISOString(),
    userId,
    data
  }));
  
  return fileId;
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type - support Excel and CSV files
    const supportedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Only Excel (.xlsx, .xls) and CSV files are supported' 
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let data: any[];
    
    // Parse file based on type
    if (file.type === 'text/csv') {
      data = await parseCSVFile(buffer);
    } else {
      data = await parseExcelFile(buffer);
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ 
        error: 'Could not extract data from file. Please ensure the file contains valid data.' 
      }, { status: 400 });
    }

    // Save file data
    const fileId = saveFileData(userId, file.name, data);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed ${file.name}`,
      fileId: fileId,
      fileName: file.name,
      rowCount: data.length,
      columnCount: data[0]?.length || 0
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error processing file' 
    }, { status: 500 });
  }
}
