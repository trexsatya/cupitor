package com.satya.extensions

import groovy.transform.Memoized
import org.codehaus.groovy.ast.ASTNode
import org.codehaus.groovy.ast.AnnotatedNode
import org.codehaus.groovy.ast.AnnotationNode
import org.codehaus.groovy.ast.ClassNode
import org.codehaus.groovy.ast.MethodNode
import org.codehaus.groovy.ast.Parameter
import org.codehaus.groovy.ast.stmt.Statement
import org.codehaus.groovy.classgen.VariableScopeVisitor
import org.codehaus.groovy.control.CompilePhase
import org.codehaus.groovy.control.SourceUnit
import org.codehaus.groovy.transform.AbstractASTTransformation
import org.codehaus.groovy.transform.GroovyASTTransformation

import static org.codehaus.groovy.ast.ClassHelper.make
import static org.codehaus.groovy.ast.tools.GeneralUtils.cloneParams

/**
 * Created by Anoop Singh on 12/17/2016.
 */
@GroovyASTTransformation(phase = CompilePhase.SEMANTIC_ANALYSIS)
class AcceptsIterableTransformation extends AbstractASTTransformation {

    private static final String CLOSURE_CALL_METHOD_NAME = "call";
    private static final Class<Memoized> MY_CLASS = Memoized.class;
    private static final ClassNode MY_TYPE = make(MY_CLASS);
    private static final String MY_TYPE_NAME = "@" + MY_TYPE.getNameWithoutPackage();
    private static final String PROTECTED_CACHE_SIZE_NAME = "protectedCacheSize";
    private static final String MAX_CACHE_SIZE_NAME = "maxCacheSize";
    private static final String CLOSURE_LABEL = "Closure";
    private static final String METHOD_LABEL = "Priv";

    @Override
    void visit(ASTNode[] nodes, SourceUnit source) {
        init(nodes, source);
        AnnotationNode annotationNode = (AnnotationNode) nodes[0];
        AnnotatedNode annotatedNode = (AnnotatedNode) nodes[1];
        if (MY_TYPE.equals(annotationNode.getClassNode()) && annotatedNode instanceof MethodNode) {
            MethodNode methodNode = (MethodNode) annotatedNode;
            ClassNode ownerClassNode = methodNode.getDeclaringClass();
            MethodNode delegatingMethod = buildDelegatingMethod(methodNode, ownerClassNode);
            ownerClassNode.addMethod(delegatingMethod);


            VariableScopeVisitor visitor = new VariableScopeVisitor(source);
            visitor.visitClass(ownerClassNode);
        }
    }

    private MethodNode buildDelegatingMethod(final MethodNode annotatedMethod, final ClassNode ownerClassNode) {
        Statement code = annotatedMethod.getCode();
        int access = ACC_PROTECTED;
        if (annotatedMethod.isStatic()) {
            access = ACC_PRIVATE | ACC_STATIC;
        }
        MethodNode method = new MethodNode(
                buildUniqueName(ownerClassNode, METHOD_LABEL, annotatedMethod),
                access,
                annotatedMethod.getReturnType(),
                cloneParams(annotatedMethod.getParameters()),
                annotatedMethod.getExceptions(),
                code
        );
        List<AnnotationNode> sourceAnnotations = annotatedMethod.getAnnotations();
        method.addAnnotations(new ArrayList<AnnotationNode>(sourceAnnotations));
        return method;
    }

    private static String buildUniqueName(ClassNode owner, String ident, MethodNode methodNode) {
        StringBuilder nameBuilder = new StringBuilder("memoizedMethod" + ident + "\$").append(methodNode.getName());
        if (methodNode.getParameters() != null) {
            for (Parameter parameter : methodNode.getParameters()) {
                nameBuilder.append(buildTypeName(parameter.getType()));
            }
        }
        while (owner.getField(nameBuilder.toString()) != null) {
            nameBuilder.insert(0, "_");
        }

        return nameBuilder.toString();
    }

    private static String buildTypeName(ClassNode type) {
        if (type.isArray()) {
            return String.format("%sArray", buildTypeName(type.getComponentType()));
        }
        return type.getNameWithoutPackage();
    }
}
