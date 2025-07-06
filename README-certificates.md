# Certificate System

The certificate system generates professional PNG certificates using custom templates that you design through the Certificate Designer. Club administrators can upload PDF templates and position text fields with complete customization control.

## Key Features

- **Custom Template Designer**: Upload your own PDF templates and design certificate layouts
- **Drag-and-Drop Field Positioning**: Visually position text fields on your certificate template
- **Complete Customization**: Control fonts, colors, sizes, alignment, and rotation for each field
- **Multiple Field Types**: Support for gymnast name, coach name, date, level info, club name, and custom text
- **PNG Output**: High-quality PNG certificates that are universally compatible
- **Automatic Generation**: Certificates are automatically generated when awarded
- **Download Access**: Certificates can be downloaded by coaches, parents, and gymnasts

## How It Works

1. **Template Management**: Club admins upload PDF templates through the Certificate Designer
2. **Field Configuration**: Position and customize text fields using the visual editor
3. **Certificate Award**: When a coach awards a certificate, it's automatically generated using the custom template
4. **PNG Generation**: The system overlays the configured text fields onto the template to create a PNG certificate

## Certificate Designer Features

- **Template Upload**: Upload PDF files as certificate templates
- **Visual Field Editor**: Drag-and-drop interface for positioning text fields
- **Font Selection**: Choose from Arial, Helvetica, Times New Roman, Courier, or custom fonts
- **Color Picker**: Select any color for text fields
- **Size Control**: Adjust font sizes from 8px to 72px
- **Weight & Style**: Control font weight (normal, bold) and alignment
- **Rotation**: Rotate text fields to any angle
- **Real-time Preview**: See changes instantly with sample data
- **Scale Control**: Adjust PDF viewer scale for precise positioning

## Field Types

- **GYMNAST_NAME**: The gymnast's full name
- **COACH_NAME**: The awarding coach's name
- **DATE**: The date the certificate was awarded
- **LEVEL_NAME**: The level or achievement name
- **LEVEL_NUMBER**: The level number or identifier
- **CLUB_NAME**: The club's name
- **CUSTOM_TEXT**: Any custom text you want to display

## Certificate Generation Process

1. **Template Loading**: Loads the configured template image
2. **Field Rendering**: Renders each text field according to its configuration
3. **PNG Creation**: Generates a high-quality PNG certificate
4. **File Management**: Saves the certificate for download

## File Structure

```
backend/
├── fonts/
│   └── LilitaOne-Regular.ttf      # Custom font for certificates
├── uploads/
│   └── certificate-templates/     # Uploaded PDF templates
├── generated-certificates/        # Generated PNG certificates
└── services/
    └── certificateService.js      # Certificate generation service
```

## API Endpoints

### Certificate Templates
- `GET /api/certificate-templates` - List all templates
- `POST /api/certificate-templates` - Upload new template
- `GET /api/certificate-templates/:id/pdf` - Download template PDF
- `PUT /api/certificate-templates/:id` - Update template
- `DELETE /api/certificate-templates/:id` - Delete template

### Certificate Fields
- `GET /api/certificate-fields/:templateId` - Get template fields
- `POST /api/certificate-fields` - Create new field
- `PUT /api/certificate-fields/:id` - Update field
- `DELETE /api/certificate-fields/:id` - Delete field

### Certificates
- `GET /api/certificates` - List certificates
- `POST /api/certificates` - Award new certificate
- `GET /api/certificates/:id/download` - Download certificate PNG

## Troubleshooting

### Template Upload Issues
1. Check that the file is a valid PDF
2. Ensure the PDF is not password-protected
3. Verify the file size is reasonable (< 10MB)

### Field Positioning Issues
1. Use the scale control to match your PDF viewer
2. Position fields at the same scale you'll use for generation
3. Use the preview feature to verify positioning

### Font Issues
1. Check that custom fonts are properly installed
2. Verify font names match exactly
3. Test with standard fonts first

### Generation Issues
1. Check that the template has configured fields
2. Verify all required data is available
3. Check server logs for detailed error messages

## Database Schema

The certificate system uses these database tables:
- `certificate_templates` - Stores template metadata
- `certificate_fields` - Stores field configurations
- `certificates` - Stores awarded certificates

## Security Notes

- Only club administrators can access the Certificate Designer
- PDF templates are stored securely in the uploads directory
- Generated certificates are protected by authentication
- File uploads are validated and sanitized

## Usage Examples

### Awarding a Certificate
```javascript
// POST /api/certificates
{
  "gymnastId": "gymnast-id",
  "levelId": "level-id",
  "templateId": "template-id",
  "type": "LEVEL_COMPLETION",
  "notes": "Excellent progress!"
}
```

### Uploading a Template
```javascript
// POST /api/certificate-templates
// FormData with PDF file upload
```

### Configuring Template Fields
```javascript
// POST /api/certificate-fields
{
  "templateId": "template-id",
  "fieldType": "GYMNAST_NAME",
  "label": "Gymnast Name",
  "x": 0.5,
  "y": 0.3,
  "fontSize": 32,
  "fontColor": "#000000",
  "fontFamily": "Arial"
}
```

## Support

For issues or questions about the certificate system:
1. Check server logs for error messages
2. Use the Certificate Designer to verify template configuration
3. Test with simple gymnast/level combinations first
4. Ensure all required dependencies are installed (`canvas`, `pdf-parse`)

The certificate system is designed to be robust and user-friendly, providing a professional solution for recognizing gymnast achievements with beautiful, customized certificates. 